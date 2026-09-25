import Memory, { MEMORY_CATEGORIES } from "../../models/Memory.js";
import Trip from "../../models/Trip.js";
import { aiRouter } from "./ai-router.service.js";
import { executeWithSchema } from "./ai-retry.service.js";
import { CurateCollageOutputSchema } from "../../schemas/memory.schemas.js";
import { parseAIJson } from "./ai-parser.js";
import { logger } from "../../utils/logger.js";
import { NotFoundError, ForbiddenError } from "../../utils/errors.js";

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
}

export const memoryAiService = new MemoryAIService();
export const enrichMemoryAsync = (id) => memoryAiService.enrichMemoryAsync(id);
export const curateCollageMemories = (opts) => memoryAiService.curateCollageMemories(opts);
export default memoryAiService;

