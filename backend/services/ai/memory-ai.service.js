import fs from "fs";
import path from "path";
import Memory, { MEMORY_CATEGORIES } from "../../models/Memory.js";
import Trip from "../../models/Trip.js";
import { aiRouter } from "./ai-router.service.js";
import { executeWithSchema } from "./ai-retry.service.js";
import { CurateCollageOutputSchema, PhotoAwareCaptionsOutputSchema } from "../../schemas/memory.schemas.js";
import { parseAIJson } from "./ai-parser.js";
import { logger } from "../../utils/logger.js";
import { NotFoundError, ForbiddenError, ValidationError } from "../../utils/errors.js";

export class MemoryAIService {
  /**
   * Asynchronously enrich a memory with factual description, tags, and category.
   * Runs in the background without blocking media upload.
   */
  async enrichMemoryAsync(memoryId) {
    try {
      const memory = await Memory.findById(memoryId);
      if (!memory || memory.isDeleted) return;

      const contextDetails = [
        memory.place ? `Location: ${memory.place}` : "",
        memory.highlight ? `Highlight: ${memory.highlight}` : "",
        memory.caption ? `Caption: ${memory.caption}` : "",
        memory.date ? `Date: ${memory.date}` : "",
        memory.mediaType ? `Type: ${memory.mediaType}` : "",
        memory.moments?.length ? `Moments: ${memory.moments.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const prompt = `You are Advenza's Travel Memory AI. Analyze the following travel memory details and return a structured JSON enrichment.

MEMORY DETAILS:
${contextDetails || "General travel memory"}

ALLOWED CATEGORIES (choose EXACTLY one):
${MEMORY_CATEGORIES.join(", ")}

INSTRUCTIONS:
1. Provide a concise, factual 1-sentence description (under 120 characters).
2. Generate 3 to 5 lowercase, searchable travel tags (e.g. ["sunset", "beach", "goa"]).
3. Select the best category from the allowed list.

Return ONLY a JSON object:
{
  "description": "...",
  "tags": ["...", "..."],
  "category": "..."
}`;

      const completion = await aiRouter.callAI({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 300,
      });

      const parsed = parseAIJson(completion.content);

      const category = MEMORY_CATEGORIES.includes(parsed.category) ? parsed.category : memory.category || "OTHER";
      const tags = Array.isArray(parsed.tags) ? parsed.tags.map((t) => String(t).toLowerCase().trim()).slice(0, 5) : [];
      const description = parsed.description ? String(parsed.description).trim() : memory.description;

      memory.category = category;
      memory.aiMetadata = {
        description,
        tags,
        category,
        processedAt: new Date(),
        status: "ready",
      };
      if (!memory.caption && description) {
        memory.caption = description;
      }
      if (tags.length > 0) {
        // Merge with existing tags without duplicates
        const existingTags = new Set(memory.tags || []);
        tags.forEach((t) => existingTags.add(t));
        memory.tags = Array.from(existingTags);
      }
      memory.status = "ready";
      await memory.save();

      logger.info(`[MemoryAI] ✅ Enriched memory ${memoryId}: Category=${category}, Tags=${tags.join(",")}`);
    } catch (err) {
      logger.warn(`[MemoryAI] AI enrichment fallback for memory ${memoryId}: ${err.message}`);
      try {
        await Memory.updateOne(
          { _id: memoryId },
          { $set: { "aiMetadata.status": "failed", status: "ready" } }
        );
      } catch (e) {
        // ignore
      }
    }
  }

  /**
   * Curate optimal memories for an aesthetic, story-driven collage.
   * Enforces strict anti-hallucination validation against input memory IDs.
   */
  async curateCollageMemories({ tripId, targetCount = 6, style = "Balanced", userId }) {
    // 1. Verify trip access
    const trip = await Trip.findById(tripId).lean();
    if (!trip) throw new NotFoundError("Trip not found");

    const isOwner = String(trip.createdBy) === String(userId);
    const isMember = Array.isArray(trip.members) && trip.members.some((m) => m.userId === userId || m.email === userId);
    if (!isOwner && !isMember) {
      throw new ForbiddenError("Access denied to this trip's memories");
    }

    // 2. Fetch active memories for this trip
    const memories = await Memory.find({ tripId, isDeleted: false })
      .sort({ n: 1, createdAt: 1 })
      .lean();

    if (memories.length === 0) {
      return {
        themeTitle: `${trip.destination || trip.title} Highlights`,
        collageLayoutTip: "Add photos to this trip to enable AI collage curation.",
        selectedMemories: [],
        excludedMemories: [],
      };
    }

    // If total memories are fewer than or equal to target count, select all
    if (memories.length <= targetCount) {
      return {
        themeTitle: `${trip.destination || trip.title} Story`,
        collageLayoutTip: "Optimal grid layout showing all trip moments.",
        selectedMemories: memories.map((m) => ({
          memoryId: String(m._id),
          reason: m.highlight || m.place || "Key trip highlight",
        })),
        excludedMemories: [],
      };
    }

    // 3. Compact payload for LLM (never sending large binaries)
    const validIdSet = new Set(memories.map((m) => String(m._id)));
    const candidatePool = memories.map((m) => ({
      memoryId: String(m._id),
      dayNumber: m.n,
      place: m.place,
      category: m.category || "OTHER",
      highlight: m.highlight,
      caption: m.caption,
      tags: m.tags || [],
    }));

    const prompt = `You are Advenza's Story Collage Curator AI. Curate the ${targetCount} best memories from the pool below to craft an engaging travel collage for "${trip.title || trip.destination}".

SELECTION CRITERIA:
1. Maximize visual and contextual diversity (Landmarks, Culture, People, Food, Scenery, Evening).
2. Ensure temporal balance across the journey from early to late days.
3. Exclude near-duplicates, repetitive selfies, or multiple shots of the same meal.
4. CRITICAL ANTI-HALLUCINATION RULE: You may ONLY return memoryId values that appear in the candidate pool. Do NOT invent memory IDs.

CANDIDATE MEMORIES POOL:
${JSON.stringify(candidatePool, null, 2)}

Return JSON adhering to schema:
{
  "themeTitle": "A creative 3-5 word title for the collage",
  "collageLayoutTip": "Short recommendation for the layout (e.g. 1 Hero landmark with 5 supporting moments)",
  "selectedMemories": [
    { "memoryId": "<valid_id>", "reason": "Why this photo was selected" }
  ],
  "excludedMemories": [
    { "memoryId": "<valid_id>", "reason": "Why this photo was deprioritized" }
  ]
}`;

    const result = await executeWithSchema(
      CurateCollageOutputSchema,
      {
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
      },
      { maxAttempts: 2 }
    );

    // 4. Strict anti-hallucination filter: enforce that all selected IDs belong to the candidate pool
    const sanitizedSelected = (result.selectedMemories || []).filter((item) =>
      validIdSet.has(item.memoryId)
    );

    const selectedIdSet = new Set(sanitizedSelected.map((s) => s.memoryId));

    // If AI failed to select enough valid memories, backfill from candidate pool
    if (sanitizedSelected.length < targetCount) {
      for (const cand of candidatePool) {
        if (!selectedIdSet.has(cand.memoryId) && sanitizedSelected.length < targetCount) {
          sanitizedSelected.push({
            memoryId: cand.memoryId,
            reason: cand.highlight || cand.place || "Balanced moment selection",
          });
          selectedIdSet.add(cand.memoryId);
        }
      }
    }

    const sanitizedExcluded = candidatePool
      .filter((cand) => !selectedIdSet.has(cand.memoryId))
      .map((cand) => ({
        memoryId: cand.memoryId,
        reason: "Secondary moment omitted for layout balance",
      }));

    return {
      themeTitle: result.themeTitle || `${trip.destination} Chronicles`,
      collageLayoutTip: result.collageLayoutTip || "Balanced dynamic grid",
      selectedMemories: sanitizedSelected,
      excludedMemories: sanitizedExcluded,
    };
  }

  /**
   * Helper that formats image references into vision-compatible input.
   * Remote URLs are passed directly; local filesystem uploads are converted to base64 data URIs.
   */
  async formatImageForVision(url) {
    if (!url || typeof url !== "string") return null;
    if (url.startsWith("data:image/")) return url;

    // Handle local uploads or relative server paths
    if (url.startsWith("/uploads/") || url.startsWith("uploads/")) {
      const cleanPath = url.replace(/^\//, "");
      const possiblePaths = [
        path.join(process.cwd(), cleanPath),
        path.join(process.cwd(), "backend", cleanPath),
      ];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          try {
            const ext = path.extname(p).toLowerCase().replace(".", "");
            const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
            const buffer = fs.readFileSync(p);
            return `data:${mime};base64,${buffer.toString("base64")}`;
          } catch (e) {
            logger.warn(`[MemoryAI] Could not read local image at ${p}: ${e.message}`);
          }
        }
      }
    }

    // Remote URLs (Cloudinary, Firebase, external CDNs)
    return url;
  }

  /**
   * Visually analyzes travel memory photos and generates 8 diverse, non-repetitive Instagram captions.
   * Captions are grounded in actual visible details (lighting, materials, architecture, landscape, mood).
   */
  async generatePhotoAwareCaptions({
    memoryId,
    imageUrls = [],
    place = "",
    highlight = "",
    caption = "",
    date = "",
    category = "",
    tonePreference = "",
    userId = null,
  }) {
    let resolvedPlace = place;
    let resolvedHighlight = highlight || caption;
    let resolvedDate = date;
    let resolvedCategory = category;
    const collectedUrls = new Set(Array.isArray(imageUrls) ? imageUrls.filter(Boolean) : []);

    // 1. If memoryId is provided, pull stored metadata and all attached photos
    if (memoryId) {
      const memory = await Memory.findById(memoryId).lean();
      if (memory && !memory.isDeleted) {
        resolvedPlace = resolvedPlace || memory.place || "";
        resolvedHighlight = resolvedHighlight || memory.highlight || memory.caption || "";
        resolvedDate = resolvedDate || memory.date || "";
        resolvedCategory = resolvedCategory || memory.category || "";

        // Collect all photos from multi-media array
        if (Array.isArray(memory.media)) {
          for (const item of memory.media) {
            if (item.url && item.resourceType !== "video") {
              collectedUrls.add(item.url);
            }
          }
        }
        if (Array.isArray(memory.mediaItems)) {
          for (const item of memory.mediaItems) {
            if (item.storageUrl && item.mediaType !== "video") {
              collectedUrls.add(item.storageUrl);
            }
          }
        }
        if (memory.mediaUrl && memory.mediaType !== "video") {
          collectedUrls.add(memory.mediaUrl);
        }
        if (memory.photo) {
          collectedUrls.add(memory.photo);
        }
      }
    }

    const candidateUrls = Array.from(collectedUrls);
    if (candidateUrls.length === 0) {
      throw new ValidationError("At least one travel photo is required for visual caption generation.");
    }

    // 2. Prepare images for multimodal vision AI (take up to 5 photos from the album)
    const visionImages = [];
    for (const rawUrl of candidateUrls.slice(0, 5)) {
      const formatted = await this.formatImageForVision(rawUrl);
      if (formatted) visionImages.push(formatted);
    }

    if (visionImages.length === 0) {
      throw new ValidationError("Unable to resolve valid image files for visual analysis.");
    }

    logger.info(
      `[MemoryAI] Analyzing ${visionImages.length} photo(s) for memory ${memoryId || "direct"} ("${resolvedPlace}")...`
    );

    // 3. Construct rich prompt demanding deep visual grounding and 8 distinct styles
    const prompt = `You are Advenza's elite travel photographer and Instagram storyteller AI.
Look closely at the attached ${visionImages.length} photo(s) from a traveler's memory album.

VISUAL ANALYSIS MANDATE:
1. Examine the actual photos with an expert photographer's eye:
   - Identify specific visible objects, materials, textures, and architecture (e.g. marble walls, vertical wood slats, floor-to-ceiling glass, chandeliers, linen sofas, coffee tables, books, indoor plants, skyline).
   - Identify the exact lighting, colors, and time of day (e.g. warm sunset glow, twilight blue hour, amber LED cove lights, natural daylight, soft reflections).
   - Discern the atmosphere and mood (e.g. tranquil, sophisticated, cinematic, cozy, vibrant, minimalist).
   - If multiple photos are present, notice how they complement each other (e.g. wide-angle room overview, close-up details, shifting light).
2. Ground your captions strictly in what is visible. Supplementary context (use only as background anchor, never contradict the photos):
   - Destination/Place: "${resolvedPlace || "Unspecified"}"
   - Date: "${resolvedDate || "Recent"}"
   - User Highlight: "${resolvedHighlight || "None"}"
   - Tone Preference: "${tonePreference || "Natural & Creative"}"

3. Generate EXACTLY 8 diverse, unique captions, one for each required style:
   1. Short & Aesthetic (Tag: "Aesthetic") - Minimalist, sensory, lowercase or clean, 4-12 words. Focus on specific visual textures, color, or light.
   2. Travel Storytelling (Tag: "Storytelling") - 1-2 sentences describing the real atmosphere and moment.
   3. Poetic (Tag: "Poetic") - Literary, evocative, focused on light, shadows, and mood.
   4. Adventure Vibe (Tag: "Adventure") - Energetic, spontaneous perspective.
   5. Luxury / Cinematic (Tag: "Cinematic") - Sophisticated, architectural, movie-still tone.
   6. Funny / Casual (Tag: "Casual") - Relatable, witty, natural human commentary.
   7. Personal & Emotional (Tag: "Emotional") - Reflective, intimate observation of slowing down.
   8. Instagram Trending Style (Tag: "Trending") - Modern social hook, punchy, effortlessly cool.

STRICT ANTI-REPETITION & ANTI-HALLUCINATION RULES:
- FORBIDDEN STARTERS: NEVER start with or use "Lost in...", "Another adventure...", "Unforgettable moments...", "Wanderlust...", "Just another day...", "Making memories in...", "Living my best life...".
- NO REPETITIVE TEMPLATES: Every single caption must have a unique sentence structure, tone, rhythm, and starting word.
- NO EMOJI OVERLOAD: Use at most 1 or 2 tasteful emojis per caption; several styles (Aesthetic, Cinematic, Poetic) should use 0 or at most 1 subtle emoji.
- NO HALLUCINATIONS: Only reference scenery, items, colors, and lighting that actually appear in the photos.
- SOUND HUMAN: Write like a real person who took these photos, not generic AI templates.

Return ONLY a JSON object:
{
  "visualSummary": "A concise sentence describing the visual scenes seen in the photos",
  "captions": [
    {
      "id": "aesthetic",
      "style": "Short & Aesthetic",
      "tag": "Aesthetic",
      "caption": "...",
      "focus": "Visual focus of this caption"
    },
    {
      "id": "storytelling",
      "style": "Travel Storytelling",
      "tag": "Storytelling",
      "caption": "...",
      "focus": "..."
    },
    {
      "id": "poetic",
      "style": "Poetic",
      "tag": "Poetic",
      "caption": "...",
      "focus": "..."
    },
    {
      "id": "adventure",
      "style": "Adventure Vibe",
      "tag": "Adventure",
      "caption": "...",
      "focus": "..."
    },
    {
      "id": "cinematic",
      "style": "Luxury / Cinematic",
      "tag": "Cinematic",
      "caption": "...",
      "focus": "..."
    },
    {
      "id": "casual",
      "style": "Funny / Casual",
      "tag": "Casual",
      "caption": "...",
      "focus": "..."
    },
    {
      "id": "emotional",
      "style": "Personal & Emotional",
      "tag": "Emotional",
      "caption": "...",
      "focus": "..."
    },
    {
      "id": "trending",
      "style": "Instagram Trending Style",
      "tag": "Trending",
      "caption": "...",
      "focus": "..."
    }
  ]
}`;

    const messageContent = [
      { type: "text", text: prompt },
      ...visionImages.map((url) => ({ type: "image_url", image_url: { url } })),
    ];

    // 4. Call multimodal vision AI router
    const result = await aiRouter.generateVisionJSON({
      messages: [{ role: "user", content: messageContent }],
      temperature: 0.75,
      maxTokens: 2500,
      timeoutMs: 35_000,
    });

    const parsed = result.data;
    const validated = PhotoAwareCaptionsOutputSchema.safeParse(parsed);

    if (!validated.success || !Array.isArray(parsed?.captions) || parsed.captions.length < 8) {
      logger.warn(`[MemoryAI] AI returned non-standard caption format, sanitizing:`, parsed);
      // Fallback normalization: ensure all 8 styles are present
      const requiredStyles = [
        { id: "aesthetic", style: "Short & Aesthetic", tag: "Aesthetic", fallback: "amber light and quiet city views." },
        { id: "storytelling", style: "Travel Storytelling", tag: "Storytelling", fallback: "Watching the twilight settle across the skyline from the lounge." },
        { id: "poetic", style: "Poetic", tag: "Poetic", fallback: "Where warm shadows meet cool dusk along the window glass." },
        { id: "adventure", style: "Adventure Vibe", tag: "Adventure", fallback: "High above the city streets finding quiet corners." },
        { id: "cinematic", style: "Luxury / Cinematic", tag: "Cinematic", fallback: "Framed in marble and dusk, every line designed for stillness." },
        { id: "casual", style: "Funny / Casual", tag: "Casual", fallback: "10/10 view, definitely not moving from this couch anytime soon." },
        { id: "emotional", style: "Personal & Emotional", tag: "Emotional", fallback: "The kind of quiet evening you carry with you long after heading home." },
        { id: "trending", style: "Instagram Trending Style", tag: "Trending", fallback: "Golden hour hit the interior just right. 🌆" },
      ];

      const rawCaptions = Array.isArray(parsed?.captions) ? parsed.captions : [];
      const sanitizedCaptions = requiredStyles.map((req, idx) => {
        const found = rawCaptions.find(
          (c) => c.tag?.toLowerCase() === req.tag.toLowerCase() || c.style?.toLowerCase().includes(req.tag.toLowerCase())
        ) || rawCaptions[idx];

        return {
          id: req.id,
          style: req.style,
          tag: req.tag,
          caption: found?.caption ? String(found.caption).trim() : req.fallback,
          focus: found?.focus ? String(found.focus).trim() : "Visual scene atmosphere",
        };
      });

      return {
        visualSummary: parsed?.visualSummary || "Visual moments captured in the memory photos",
        captions: sanitizedCaptions,
        provider: result.provider,
        model: result.model,
      };
    }

    return {
      visualSummary: validated.data.visualSummary,
      captions: validated.data.captions,
      provider: result.provider,
      model: result.model,
    };
  }
}

export const memoryAiService = new MemoryAIService();
export const enrichMemoryAsync = (id) => memoryAiService.enrichMemoryAsync(id);
export const curateCollageMemories = (opts) => memoryAiService.curateCollageMemories(opts);
export const generatePhotoAwareCaptions = (opts) => memoryAiService.generatePhotoAwareCaptions(opts);
export default memoryAiService;


