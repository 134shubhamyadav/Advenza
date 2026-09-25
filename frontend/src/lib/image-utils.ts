/**
 * Client-side media validation, thumbnailing, and compression utilities.
 * Ensures media files meet security, size, and dimension criteria before uploading.
 */

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
];

const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime", // MOV
];

/**
 * Validates either an image or a video file against allowed MIME types and size thresholds.
 */
export const validateMediaFile = (
  file: File,
  maxImageSizeMb = 20,
  maxVideoSizeMb = 100
): { valid: boolean; mediaType: "image" | "video"; error?: string } => {
  if (!file) {
    return { valid: false, mediaType: "image", error: "No file provided" };
  }

  const type = (file.type || "").toLowerCase();
  const ext = file.name.split(".").pop()?.toLowerCase() || "";

  const isImage =
    ALLOWED_IMAGE_TYPES.includes(type) ||
    ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"].includes(ext);
  const isVideo =
    ALLOWED_VIDEO_TYPES.includes(type) ||
    ["mp4", "webm", "mov"].includes(ext);

  if (!isImage && !isVideo) {
    return {
      valid: false,
      mediaType: "image",
      error: `Unsupported file format. Supported formats: JPEG, PNG, WebP, HEIC, MP4, WebM, MOV.`,
    };
  }

  const mediaType: "image" | "video" = isVideo ? "video" : "image";
  const limitMb = isVideo ? maxVideoSizeMb : maxImageSizeMb;
  const maxBytes = limitMb * 1024 * 1024;

  if (file.size > maxBytes) {
    return {
      valid: false,
      mediaType,
      error: `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds limit of ${limitMb}MB for ${mediaType}s.`,
    };
  }

  return { valid: true, mediaType };
};

/**
 * Backward compatible validator specifically for images.
 */
export const validateImageFile = (
  file: File,
  maxSizeMb = 20
): { valid: boolean; error?: string } => {
  const result = validateMediaFile(file, maxSizeMb);
  if (!result.valid) return { valid: false, error: result.error };
  if (result.mediaType !== "image") {
    return { valid: false, error: "Only image files are permitted here." };
  }
  return { valid: true };
};

/**
 * Resizes and compresses an image file to reduce bandwidth and storage overhead.
 */
export const compressImage = (
  file: File | Blob,
  maxWidth = 1920,
  quality = 0.82
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get 2D canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Canvas toBlob failed"));
            }
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Generates a lightweight thumbnail (max 360px) for responsive timeline previews.
 */
export const generateThumbnail = (
  file: File | Blob,
  maxDimension = 360,
  quality = 0.75
): Promise<Blob> => {
  return compressImage(file, maxDimension, quality);
};

/**
 * Generates a video poster/thumbnail by seeking into the video and rendering a frame to canvas.
 */
export const generateVideoThumbnail = (
  file: File | Blob,
  seekTimeSec = 1.0
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(file);
    video.src = url;

    // Timeout guard: if metadata doesn't load within 8s, reject cleanly
    const timeoutId = setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error("Video preview generation timed out."));
    }, 8000);

    video.onloadedmetadata = () => {
      const targetTime = Math.min(
        seekTimeSec,
        video.duration > 0 ? video.duration / 2 : 0
      );
      video.currentTime = targetTime;
    };

    video.onseeked = () => {
      clearTimeout(timeoutId);
      try {
        const maxWidth = 480;
        let width = video.videoWidth || 480;
        let height = video.videoHeight || 360;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error("Failed to get 2D canvas context"));
          return;
        }

        ctx.drawImage(video, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Video thumbnail canvas conversion failed"));
            }
          },
          "image/jpeg",
          0.8
        );
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    video.onerror = () => {
      clearTimeout(timeoutId);
      URL.revokeObjectURL(url);
      reject(new Error("Failed to process video file for thumbnail generation."));
    };
  });
};
