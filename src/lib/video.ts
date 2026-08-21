type SerializableVideo = {
  fileSize: bigint;
  storageStatus: string;
  ownerId?: string;
  storageKey?: string | null;
  uploadId?: string | null;
};

export function serializeVideo<T extends SerializableVideo>(video: T) {
  const safe = { ...video, fileSize: video.fileSize.toString() };
  delete safe.ownerId;
  delete safe.storageKey;
  delete safe.uploadId;
  return safe;
}
