export const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024;

export const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
} as const;

export type ImageMimeType = keyof typeof IMAGE_TYPES;
export type ImageResource = "clubs" | "players";

export function isImageMimeType(value: unknown): value is ImageMimeType {
  return typeof value === "string" && value in IMAGE_TYPES;
}

export function imagePath(resource: ImageResource, id: string) {
  return `/api/images/${resource}/${id}`;
}
