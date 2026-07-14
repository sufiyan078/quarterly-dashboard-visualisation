import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Compresses and resizes an image file client-side using HTML5 Canvas.
 * If the image is a PNG, it preserves PNG format to maintain transparency but resizes it.
 * Otherwise, it compresses to JPEG format with the specified quality.
 */
export function compressImage(
  file: File,
  maxDimension: number = 800,
  quality: number = 0.7
): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const format = file.type === "image/png" ? "image/png" : "image/jpeg";
            const dataUrl = canvas.toDataURL(format, format === "image/jpeg" ? quality : undefined);
            resolve(dataUrl);
          } else {
            resolve(event.target?.result as string);
          }
        } catch (e) {
          console.error("Canvas compression failed, using original file", e);
          resolve(event.target?.result as string);
        }
      };
      img.onerror = () => {
        resolve(event.target?.result as string);
      };
    };
    reader.onerror = () => {
      resolve("");
    };
  });
}

