export interface OfflineEstimateDraft<T> {
  fields: T;
  attachments: Array<{ name: string; type: string; mediaType: "photo" | "voice"; blob: Blob }>;
  savedAt: string;
}

const DB_NAME = "tradeflow-field-drafts";
const STORE_NAME = "drafts";
const DRAFT_KEY = "unsent-estimate";

function openDraftDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local draft storage."));
  });
}

export async function saveOfflineEstimateDraft<T>(fields: T, attachments: OfflineEstimateDraft<T>["attachments"]) {
  const db = await openDraftDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({ fields, attachments, savedAt: new Date().toISOString() }, DRAFT_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save this draft."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Draft save was interrupted."));
  });
  db.close();
}

export async function loadOfflineEstimateDraft<T>(): Promise<OfflineEstimateDraft<T> | null> {
  const db = await openDraftDb();
  const result = await new Promise<OfflineEstimateDraft<T> | null>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(DRAFT_KEY);
    request.onsuccess = () => resolve((request.result as OfflineEstimateDraft<T> | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Could not read the saved draft."));
  });
  db.close();
  return result;
}

export async function clearOfflineEstimateDraft() {
  const db = await openDraftDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(DRAFT_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not remove the saved draft."));
  });
  db.close();
}
