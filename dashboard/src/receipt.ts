// Receipt photo rules shared by the Add-expense form and the data adapter.
export const RECEIPT_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const EXT: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif" };

/** Browsers often report HEIC files with an empty type, so fall back to the file extension. */
export function receiptType(f: File): string {
  if (TYPES.includes(f.type)) return f.type;
  return EXT[f.name.split(".").pop()?.toLowerCase() ?? ""] ?? f.type;
}

/** A plain-language reason the file can't be used, or null if it's fine. */
export function checkReceipt(f: File): string | null {
  if (!TYPES.includes(receiptType(f))) return "That file isn't a photo we can use. Choose a JPEG, PNG, WebP or HEIC image.";
  if (f.size > RECEIPT_MAX_BYTES) return `That photo is ${(f.size / 1048576).toFixed(1)} MB. The limit is 5 MB. Choose a smaller photo.`;
  if (f.size === 0) return "That file is empty. Choose another photo.";
  return null;
}

/** HEIC usually can't be previewed in a browser; show the file name instead. */
export const canPreview = (f: File) => ["image/jpeg", "image/png", "image/webp"].includes(receiptType(f));
