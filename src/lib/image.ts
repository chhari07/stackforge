"use client";

// Lets the user pick a photo and turns it into a small square JPEG data URL
// (profile photo, playlist cover). Small enough to store and sync as text.
export function pickImage(size = 512): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? await squareJpeg(file, size).catch(() => null) : null);
    };
    // Picker closed without a choice.
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

export async function squareJpeg(file: Blob, size = 512): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(size, side);
  const ctx = canvas.getContext("2d")!;
  // Centre crop to a square.
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

/** Lets the user pick an image file (to frame it with ImageCropper). */
export function pickFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

/** Cuts `crop` (in the image's own pixels) out of the file into a `width` × `height` JPEG data URL. */
export async function cropJpeg(
  file: Blob,
  crop: { x: number; y: number; w: number; h: number },
  width: number,
  height: number,
  quality = 0.82,
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  // Never larger than the part of the photo that was picked.
  const scale = Math.min(1, crop.w / width);
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // transparent PNGs get a white background, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}
