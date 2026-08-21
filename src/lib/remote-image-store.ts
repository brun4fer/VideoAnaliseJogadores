import { apiFetch } from "@/lib/http";
import { IMAGE_TYPES, MAX_IMAGE_FILE_SIZE, type ImageResource, isImageMimeType } from "@/lib/image-storage";

type UploadProgress = { loaded: number; total: number; progress: number };

export async function uploadStoredImage(resource: ImageResource, id: string, file: File, onProgress?: (status: UploadProgress) => void) {
  if (!isImageMimeType(file.type)) {
    throw new Error(`Choose a supported image (${Object.values(IMAGE_TYPES).join(", ")}).`);
  }
  if (!file.size || file.size > MAX_IMAGE_FILE_SIZE) {
    throw new Error("The image must be smaller than 10 MB.");
  }

  const endpoint = `/api/images/${resource}/${id}`;
  const prepared = await apiFetch<{ uploadUrl: string; storageKey: string }>(endpoint, {
    method: "POST",
    body: JSON.stringify({ fileName: file.name, fileSize: file.size, mimeType: file.type }),
  });
  try {
    const etag = await putImage(prepared.uploadUrl, file, onProgress);
    return await apiFetch<{ imageUrl: string; uploadedAt: string }>(endpoint, {
      method: "PATCH",
      body: JSON.stringify({ storageKey: prepared.storageKey, fileName: file.name, fileSize: file.size, mimeType: file.type, etag }),
    });
  } catch (error) {
    await apiFetch(`${endpoint}?pendingKey=${encodeURIComponent(prepared.storageKey)}`, { method: "DELETE" }).catch(() => undefined);
    throw error;
  }
}

function putImage(url: string, file: File, onProgress?: (status: UploadProgress) => void) {
  return new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", file.type);
    request.upload.onprogress = (event) => {
      const total = event.lengthComputable ? event.total : file.size;
      onProgress?.({ loaded: event.loaded, total, progress: total ? event.loaded / total : 0 });
    };
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(`Cloudflare rejected the image (${request.status}).`));
        return;
      }
      const etag = request.getResponseHeader("ETag");
      if (!etag) {
        reject(new Error("Cloudflare did not return the image ETag. Check the bucket CORS policy."));
        return;
      }
      resolve(etag);
    };
    request.onerror = () => reject(new Error(`Cloudflare blocked or interrupted the image upload from ${window.location.origin}. Add this exact origin to the bucket CORS policy.`));
    request.send(file);
  });
}
