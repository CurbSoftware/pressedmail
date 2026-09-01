/**
 * Image Upload Service
 *
 * Handles uploading images to the WordPress server for use in email composition.
 * Supports both inline images and attachments.
 */

import { buildApiUrl, routeApiPrefix } from "@/context/Strings";
import { apiFetch } from "@/lib/api-client";

export interface UploadedImage {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface UploadImageOptions {
  /**
   * Compress images before upload (reduces size but may affect quality)
   */
  compress?: boolean;
  /**
   * Maximum width/height in pixels (preserves aspect ratio)
   */
  maxDimension?: number;
  /**
   * JPEG quality (0-1) when compressing
   */
  quality?: number;
}

const DEFAULT_OPTIONS: UploadImageOptions = {
  compress: true,
  maxDimension: 1200,
  quality: 0.85,
};

/**
 * Compress an image file to reduce size
 */
async function compressImage(
  file: File,
  options: UploadImageOptions,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    img.onload = () => {
      let { width, height } = img;
      const maxDim = options.maxDimension || 1200;

      // Scale down if necessary
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = (height / width) * maxDim;
          width = maxDim;
        } else {
          width = (width / height) * maxDim;
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;

      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob
      const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
      const quality = mimeType === "image/jpeg" ? options.quality || 0.85 : 1;

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to compress image"));
          }
        },
        mimeType,
        quality,
      );
    };

    img.onerror = () => {
      reject(new Error("Failed to load image for compression"));
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Upload an image file to the server
 *
 * @param file - The image file to upload
 * @param options - Optional compression settings
 * @returns The URL of the uploaded image
 */
export async function uploadImage(
  file: File,
  options: UploadImageOptions = DEFAULT_OPTIONS,
): Promise<string> {
  let uploadFile: File | Blob = file;

  // Compress if enabled and file is large enough to benefit
  if (options.compress && file.size > 100 * 1024) {
    // > 100KB
    try {
      uploadFile = await compressImage(file, options);
    } catch {
      // Fall back to original file if compression fails
      console.warn("Image compression failed, uploading original");
    }
  }

  const formData = new FormData();
  formData.append("file", uploadFile, file.name);

  const url = buildApiUrl(`${routeApiPrefix}/attachments/upload-image`);

  const response = await apiFetch(url, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Upload failed: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success || !data.data?.url) {
    throw new Error(data.message || "Upload failed");
  }

  return data.data.url;
}

/**
 * Convert a File to a base64 data URL
 * Useful for previewing images before upload
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Validate an image file
 */
export function validateImage(
  file: File,
  options: {
    maxSize?: number;
    acceptedTypes?: string[];
  } = {},
): { valid: boolean; error?: string } {
  const maxSize = options.maxSize || 10 * 1024 * 1024; // 10MB default
  const acceptedTypes = options.acceptedTypes || [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ];

  if (!acceptedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type: ${file.type}. Accepted: ${acceptedTypes.join(", ")}`,
    };
  }

  if (file.size > maxSize) {
    const maxMB = Math.round(maxSize / 1024 / 1024);
    return {
      valid: false,
      error: `File too large: ${Math.round(file.size / 1024 / 1024)}MB. Maximum: ${maxMB}MB`,
    };
  }

  return { valid: true };
}
