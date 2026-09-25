import sharp from "sharp";
import { logger } from "../../utils/logger.js";

// Centralized Aspect Ratio & Canvas Dimensions
export const ASPECT_RATIO_CONFIG = {
  "1:1": { width: 1200, height: 1200, name: "Square (1:1)" },
  "4:5": { width: 1200, height: 1500, name: "Instagram Portrait (4:5)" },
  "3:4": { width: 1200, height: 1600, name: "Classic Print (3:4)" },
  "16:9": { width: 1920, height: 1080, name: "Landscape (16:9)" },
  "9:16": { width: 1080, height: 1920, name: "Stories / Reels (9:16)" },
};

// Theme Color Palettes
export const THEME_PALETTES = {
  dark: { bg: "#090D16", cardBg: "#131A29", text: "#FFFFFF", subtext: "#94A3B8" },
  light: { bg: "#F8FAFC", cardBg: "#FFFFFF", text: "#0F172A", subtext: "#64748B" },
  warm: { bg: "#FAF6F0", cardBg: "#FFFFFF", text: "#292524", subtext: "#78716C" },
  ocean: { bg: "#0B192C", cardBg: "#1E3E62", text: "#FFFFFF", subtext: "#93C5FD" },
  sand: { bg: "#EFE9DF", cardBg: "#FDFCFA", text: "#3E3831", subtext: "#8C8275" },
  sunset: { bg: "#281424", cardBg: "#431C3D", text: "#FFF1F2", subtext: "#FDA4AF" },
  blur: { bg: "#090D16", cardBg: "#131A29", text: "#FFFFFF", subtext: "#E2E8F0" },
};

/**
 * Strictly escapes user-controlled strings to prevent SVG injection vulnerabilities.
 */
export function escapeXml(unsafe) {
  if (!unsafe) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Calculates slot coordinates and dimensions for the 'grid' layout.
 * Dynamically balances rows and columns so there are never broken empty cells.
 */
export function computeGridLayout(width, height, count, padding = 40, gap = 20) {
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const isVertical = height > width;

  let cols = 2;
  let rows = 2;

  if (count === 2) {
    cols = isVertical ? 1 : 2;
    rows = isVertical ? 2 : 1;
  } else if (count === 3) {
    // 1 prominent slot + 2 half slots
    const halfH = Math.round((innerH - gap) / 2);
    const halfW = Math.round((innerW - gap) / 2);
    if (isVertical) {
      return [
        { x: padding, y: padding, width: innerW, height: halfH },
        { x: padding, y: padding + halfH + gap, width: halfW, height: halfH },
        { x: padding + halfW + gap, y: padding + halfH + gap, width: halfW, height: halfH },
      ];
    } else {
      return [
        { x: padding, y: padding, width: halfW, height: innerH },
        { x: padding + halfW + gap, y: padding, width: halfW, height: halfH },
        { x: padding + halfW + gap, y: padding + halfH + gap, width: halfW, height: halfH },
      ];
    }
  } else if (count === 4) {
    cols = 2;
    rows = 2;
  } else if (count <= 6) {
    cols = isVertical ? 2 : 3;
    rows = isVertical ? 3 : 2;
  } else if (count <= 9) {
    cols = 3;
    rows = 3;
  } else if (count <= 12) {
    cols = isVertical ? 3 : 4;
    rows = isVertical ? 4 : 3;
  } else {
    cols = 4;
    rows = Math.ceil(count / 4);
  }

  const slotW = Math.round((innerW - (cols - 1) * gap) / cols);
  const slotH = Math.round((innerH - (rows - 1) * gap) / rows);

  const slots = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    slots.push({
      x: padding + c * (slotW + gap),
      y: padding + r * (slotH + gap),
      width: slotW,
      height: slotH,
    });
  }
  return slots;
}

/**
 * Calculates slot coordinates for the 'hero' layout.
 * One dominant photo (55-60% area) with supporting photos alongside/below.
 */
export function computeHeroLayout(width, height, count, padding = 40, gap = 20) {
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const isVertical = height >= width;

  if (count <= 2) {
    return computeGridLayout(width, height, count, padding, gap);
  }

  const supportCount = count - 1;
  const slots = [];

  if (isVertical) {
    // Hero occupies top 52%
    const heroH = Math.round(innerH * 0.52);
    const supportH = innerH - heroH - gap;
    slots.push({ x: padding, y: padding, width: innerW, height: heroH, isHero: true });

    // Supporting grid below
    const supportCols = supportCount <= 3 ? supportCount : Math.ceil(supportCount / 2);
    const supportRows = supportCount <= 3 ? 1 : 2;
    const tileW = Math.round((innerW - (supportCols - 1) * gap) / supportCols);
    const tileH = Math.round((supportH - (supportRows - 1) * gap) / supportRows);

    for (let i = 0; i < supportCount; i++) {
      const r = Math.floor(i / supportCols);
      const c = i % supportCols;
      slots.push({
        x: padding + c * (tileW + gap),
        y: padding + heroH + gap + r * (tileH + gap),
        width: tileW,
        height: tileH,
      });
    }
  } else {
    // Hero occupies left 55%
    const heroW = Math.round(innerW * 0.55);
    const supportW = innerW - heroW - gap;
    slots.push({ x: padding, y: padding, width: heroW, height: innerH, isHero: true });

    const supportRows = supportCount <= 3 ? supportCount : Math.ceil(supportCount / 2);
    const supportCols = supportCount <= 3 ? 1 : 2;
    const tileW = Math.round((supportW - (supportCols - 1) * gap) / supportCols);
    const tileH = Math.round((innerH - (supportRows - 1) * gap) / supportRows);

    for (let i = 0; i < supportCount; i++) {
      const r = Math.floor(i / supportCols);
      const c = i % supportCols;
      slots.push({
        x: padding + heroW + gap + c * (tileW + gap),
        y: padding + r * (tileH + gap),
        width: tileW,
        height: tileH,
      });
    }
  }

  return slots;
}

/**
 * Calculates slot coordinates for the 'editorial' travel journal layout.
 * Leaves dedicated margins for stylized typography and borders.
 */
export function computeEditorialLayout(width, height, count, padding = 50, gap = 24) {
  const headerHeight = 120;
  const footerHeight = 70;
  const innerW = width - padding * 2;
  const photoAreaH = height - padding * 2 - headerHeight - footerHeight;

  if (count === 2) {
    const tileW = Math.round((innerW - gap) / 2);
    return [
      { x: padding, y: padding + headerHeight, width: tileW, height: photoAreaH },
      { x: padding + tileW + gap, y: padding + headerHeight, width: tileW, height: photoAreaH },
    ];
  }

  // 1 Main Hero + 2 or more bottom tiles
  const heroH = Math.round(photoAreaH * 0.58);
  const bottomH = photoAreaH - heroH - gap;
  const bottomCount = count - 1;
  const bottomW = Math.round((innerW - (bottomCount - 1) * gap) / bottomCount);

  const slots = [
    { x: padding, y: padding + headerHeight, width: innerW, height: heroH, isHero: true },
  ];

  for (let i = 0; i < bottomCount; i++) {
    slots.push({
      x: padding + i * (bottomW + gap),
      y: padding + headerHeight + heroH + gap,
      width: bottomW,
      height: bottomH,
    });
  }

  return slots;
}

/**
 * Calculates slot coordinates for the 'polaroid' scrapbook layout.
 * White card borders with deterministic rotation angles.
 */
export function computePolaroidLayout(width, height, count, padding = 60, gap = 30) {
  const baseSlots = computeGridLayout(width, height, count, padding, gap);
  const deterministicAngles = [-2.5, 2.0, -1.8, 2.4, -2.0, 1.6, -1.5, 2.2, -1.2];

  return baseSlots.map((slot, idx) => ({
    ...slot,
    cardPadding: Math.round(Math.min(slot.width, slot.height) * 0.05),
    cardBottomExtra: Math.round(Math.min(slot.width, slot.height) * 0.16),
    rotation: deterministicAngles[idx % deterministicAngles.length],
  }));
}

/**
 * Calculates slot coordinates for the 'masonry' layout.
 * Dynamic alternating column tiles avoiding empty gaps.
 */
export function computeMasonryLayout(width, height, count, padding = 40, gap = 20) {
  const cols = count <= 3 ? 2 : 3;
  const innerW = width - padding * 2;
  const colW = Math.round((innerW - (cols - 1) * gap) / cols);
  const colHeights = new Array(cols).fill(padding);
  const slots = [];

  const heightFactors = [1.2, 0.9, 1.1, 0.85, 1.3, 1.0, 0.95, 1.15];

  for (let i = 0; i < count; i++) {
    // Choose column with lowest current height
    let targetCol = 0;
    for (let c = 1; c < cols; c++) {
      if (colHeights[c] < colHeights[targetCol]) targetCol = c;
    }

    const factor = heightFactors[i % heightFactors.length];
    const tileH = Math.round(colW * factor);

    slots.push({
      x: padding + targetCol * (colW + gap),
      y: colHeights[targetCol],
      width: colW,
      height: tileH,
    });

    colHeights[targetCol] += tileH + gap;
  }

  return slots;
}

/**
 * Core Sharp Collage Engine
 */
export class CollageEngine {
  /**
   * Main entry point to generate a composite collage image.
   *
   * @param {Object} params
   * @param {Buffer[]} params.imageBuffers Array of image file buffers in memory
   * @param {string} params.layout "grid" | "hero" | "editorial" | "masonry" | "polaroid"
   * @param {string} params.aspectRatio "1:1" | "4:5" | "3:4" | "16:9" | "9:16"
   * @param {string} params.theme "dark" | "light" | "warm" | "ocean" | "sand" | "sunset" | "blur"
   * @param {string} [params.title] Travel Story Title
   * @param {string} [params.subtitle] Destination / Date range subtitle
   * @param {string} [params.format="webp"] "webp" | "jpeg" | "png"
   * @param {string} [params.quality="standard"] "standard" | "high"
   * @returns {Promise<{ buffer: Buffer, width: number, height: number, format: string, size: number }>}
   */
  async generateCollage({
    imageBuffers,
    layout = "grid",
    aspectRatio = "1:1",
    theme = "dark",
    title = "",
    subtitle = "",
    format = "webp",
    quality = "standard",
  }) {
    if (!imageBuffers || imageBuffers.length === 0) {
      throw new Error("No image buffers provided for collage generation");
    }

    const dimensions = ASPECT_RATIO_CONFIG[aspectRatio] || ASPECT_RATIO_CONFIG["1:1"];
    const { width, height } = dimensions;
    const palette = THEME_PALETTES[theme] || THEME_PALETTES.dark;

    logger.info(
      `[CollageEngine] Generating ${layout} (${aspectRatio}: ${width}x${height}) with ${imageBuffers.length} photos in theme '${theme}'`
    );

    // 1. Calculate slot coordinates based on selected layout
    let slots;
    switch (layout) {
      case "hero":
        slots = computeHeroLayout(width, height, imageBuffers.length);
        break;
      case "editorial":
        slots = computeEditorialLayout(width, height, imageBuffers.length);
        break;
      case "polaroid":
        slots = computePolaroidLayout(width, height, imageBuffers.length);
        break;
      case "masonry":
        slots = computeMasonryLayout(width, height, imageBuffers.length);
        break;
      case "grid":
      default:
        slots = computeGridLayout(width, height, imageBuffers.length);
        break;
    }

    // 2. Prepare background base canvas
    let baseCanvas;
    if (theme === "blur" && imageBuffers[0]) {
      // Gaussian blurred background generated from the dominant first photo
      baseCanvas = await sharp(imageBuffers[0])
        .resize(width, height, { fit: "cover" })
        .blur(45)
        .modulate({ brightness: 0.7, saturation: 1.2 })
        .toBuffer();
    } else {
      // Clean theme-colored solid canvas
      baseCanvas = await sharp({
        create: {
          width,
          height,
          channels: 4,
          background: palette.bg,
        },
      })
        .png()
        .toBuffer();
    }

    // 3. Process each photo into its corresponding slot
    const compositeOperations = [];

    for (let i = 0; i < Math.min(slots.length, imageBuffers.length); i++) {
      const slot = slots[i];
      const rawBuffer = imageBuffers[i];

      try {
        if (layout === "polaroid") {
          // Render photo inside a white polaroid card
          const cardP = slot.cardPadding || 16;
          const cardExtraBottom = slot.cardBottomExtra || 50;
          const photoW = slot.width - cardP * 2;
          const photoH = slot.height - cardP * 2 - cardExtraBottom;

          if (photoW > 10 && photoH > 10) {
            const resizedPhoto = await sharp(rawBuffer)
              .resize(photoW, photoH, { fit: "cover", position: "center" })
              .toBuffer();

            // Create white card base
            const card = await sharp({
              create: {
                width: slot.width,
                height: slot.height,
                channels: 4,
                background: "#FFFFFF",
              },
            })
              .composite([
                {
                  input: resizedPhoto,
                  top: cardP,
                  left: cardP,
                },
              ])
              .png()
              .toBuffer();

            compositeOperations.push({
              input: card,
              top: Math.max(0, slot.y),
              left: Math.max(0, slot.x),
            });
          }
        } else {
          // Standard / Editorial / Hero / Masonry slot
          const resized = await sharp(rawBuffer)
            .resize(slot.width, slot.height, {
              fit: "cover",
              position: "center",
            })
            .toBuffer();

          compositeOperations.push({
            input: resized,
            top: Math.max(0, slot.y),
            left: Math.max(0, slot.x),
          });
        }
      } catch (tileErr) {
        logger.warn(`[CollageEngine] Error processing tile ${i}: ${tileErr.message}`);
      }
    }

    // 4. Render typography overlay (Editorial header/footer or Polaroid caption)
    if (layout === "editorial" || title || subtitle) {
      const textOverlay = this._buildSvgTextOverlay({
        width,
        height,
        layout,
        title,
        subtitle,
        palette,
      });

      if (textOverlay) {
        compositeOperations.push({
          input: Buffer.from(textOverlay),
          top: 0,
          left: 0,
        });
      }
    }

    // 5. Execute single-pass composite
    let pipeline = sharp(baseCanvas).composite(compositeOperations);

    // 6. Encode into target output format
    const qualityNum = quality === "high" ? 92 : 82;

    let outputBuffer;
    if (format === "jpeg") {
      outputBuffer = await pipeline.jpeg({ quality: qualityNum, mozjpeg: true }).toBuffer();
    } else if (format === "png") {
      outputBuffer = await pipeline.png({ compressionLevel: 8 }).toBuffer();
    } else {
      // Default to WebP for superior compression and visual fidelity
      outputBuffer = await pipeline.webp({ quality: qualityNum, effort: 4 }).toBuffer();
    }

    return {
      buffer: outputBuffer,
      width,
      height,
      format,
      size: outputBuffer.length,
    };
  }

  /**
   * Generates a safe, sanitized SVG text overlay for headers, titles, and branding.
   */
  _buildSvgTextOverlay({ width, height, layout, title, subtitle, palette }) {
    const safeTitle = escapeXml(title || "ADVENZA TRAVEL JOURNAL");
    const safeSubtitle = escapeXml(subtitle || new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }));

    if (layout === "editorial") {
      return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .journal-title { font-family: 'Instrument Serif', Georgia, serif; font-size: 38px; fill: ${palette.text}; font-weight: bold; letter-spacing: 2px; }
    .journal-sub { font-family: Inter, system-ui, sans-serif; font-size: 14px; fill: ${palette.subtext}; font-weight: 500; letter-spacing: 3px; text-transform: uppercase; }
    .footer-brand { font-family: Inter, system-ui, sans-serif; font-size: 12px; fill: ${palette.subtext}; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; }
    .divider { stroke: ${palette.subtext}; stroke-opacity: 0.3; stroke-width: 1; }
  </style>

  <!-- Editorial Top Header -->
  <text x="50" y="75" class="journal-title">${safeTitle}</text>
  <text x="50" y="105" class="journal-sub">${safeSubtitle}</text>
  <line x1="50" y1="125" x2="${width - 50}" y2="125" class="divider" />

  <!-- Editorial Footer Watermark -->
  <line x1="50" y1="${height - 50}" x2="${width - 50}" y2="${height - 50}" class="divider" />
  <text x="50" y="${height - 25}" class="footer-brand">ADVENZA · STORY COMPOSITION</text>
  <text x="${width - 50}" y="${height - 25}" text-anchor="end" class="footer-brand">${new Date().getFullYear()}</text>
</svg>`;
    }

    // Default title banner if user provided a title
    if (title) {
      return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .hero-title { font-family: Inter, system-ui, sans-serif; font-size: 26px; fill: ${palette.text}; font-weight: 700; letter-spacing: 1px; }
    .hero-sub { font-family: Inter, system-ui, sans-serif; font-size: 13px; fill: ${palette.subtext}; font-weight: 500; }
  </style>
  <text x="45" y="${height - 45}" class="hero-title">${safeTitle}</text>
  ${safeSubtitle ? `<text x="45" y="${height - 24}" class="hero-sub">${safeSubtitle}</text>` : ""}
</svg>`;
    }

    return null;
  }
}

export const collageEngine = new CollageEngine();
export default collageEngine;
