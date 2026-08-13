const DATABASE_NAME = "video-analise-jogadores";
const STORE_NAME = "match-videos";
const sessionVideos = new Map<string, File>();
export const MAX_PERSISTED_VIDEO_SIZE = 1024 * 1024 * 1024;

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "matchId" }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function rememberMatchVideo(matchId: string, file: File) {
  sessionVideos.set(matchId, file);
  if (file.size > MAX_PERSISTED_VIDEO_SIZE) return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({ matchId, file, savedAt: Date.now() });
    transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function getRememberedMatchVideo(matchId: string) {
  if (sessionVideos.has(matchId)) return sessionVideos.get(matchId) || null;
  const database = await openDatabase();
  const file = await new Promise<File | null>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(matchId);
    request.onsuccess = () => resolve(request.result?.file || null); request.onerror = () => reject(request.error);
  });
  database.close(); if (file) sessionVideos.set(matchId, file); return file;
}
