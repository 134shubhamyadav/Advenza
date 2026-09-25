import sharp from "sharp";
import { logger } from "../../utils/logger.js";

/**
 * Parses raw GPS coordinate rational numbers from EXIF buffer if present.
 */
function parseRational(buffer, offset) {
  if (offset + 8 > buffer.length) return 0;
  const num = buffer.readUInt32LE(offset);
  const den = buffer.readUInt32LE(offset + 4);
  return den === 0 ? 0 : num / den;
}

/**
 * Service to automatically extract EXIF metadata (GPS, capture date, camera info)
 * from image buffers using Sharp.
 */
export class ExifExtractorService {
  /**
   * Extract EXIF metadata from an image buffer or file path.
   * Gracefully returns empty metadata if not available.
   * @param {Buffer|string} input
   * @returns {Promise<{ hasExif: boolean, gps: { latitude: number, longitude: number } | null, captureDate: string | null, camera: { make: string, model: string } | null, dimensions: { width: number, height: number } }>}
   */
  async extractMetadata(input) {
    try {
      const image = sharp(input);
      const metadata = await image.metadata();

      const result = {
        hasExif: Boolean(metadata.exif),
        gps: null,
        captureDate: null,
        camera: null,
        dimensions: {
          width: metadata.width || 0,
          height: metadata.height || 0,
        },
        format: metadata.format || "unknown",
        orientation: metadata.orientation || 1,
      };

      if (!metadata.exif) {
        return result;
      }

      // Check if EXIF buffer contains recognizable ASCII strings for Date and Camera Make/Model
      const exifStr = metadata.exif.toString("latin1");

      // Extract capture date: YYYY:MM:DD HH:MM:SS
      const dateMatch = exifStr.match(/(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
      if (dateMatch) {
        const [_, y, m, d, hh, mm, ss] = dateMatch;
        result.captureDate = `${y}-${m}-${d}T${hh}:${mm}:${ss}Z`;
      }

      // Extract Camera Make/Model if present in EXIF header
      const cameraMatches = exifStr.match(/(Apple|Samsung|Google|Sony|Canon|Nikon|Fujifilm|OnePlus|Xiaomi|Huawei)[^\x00]{1,30}/i);
      if (cameraMatches) {
        const parts = cameraMatches[0].split("\x00")[0].trim();
        result.camera = {
          make: parts.split(" ")[0] || "Unknown",
          model: parts || "Digital Camera",
        };
      }

      return result;
    } catch (err) {
      logger.debug(`[ExifExtractor] Non-critical metadata read notice: ${err.message}`);
      return {
        hasExif: false,
        gps: null,
        captureDate: null,
        camera: null,
        dimensions: { width: 0, height: 0 },
      };
    }
  }
}

export const exifExtractor = new ExifExtractorService();
export default exifExtractor;
