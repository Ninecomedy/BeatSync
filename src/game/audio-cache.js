// Audio never leaves this browser. Store one validated source Blob per existing song ID.
function access(mode, action) {
  return new Promise((resolve, reject) => {
    let db,
      transaction,
      result,
      settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      db?.close();
      error ? reject(error) : resolve(result);
    };
    const timer = setTimeout(() => {
      transaction?.abort();
      finish(new Error('Browser audio storage timed out'));
    }, 5000);
    try {
      const open = indexedDB.open('beatsync.audio.v1', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('audio', { keyPath: 'songId' });
      open.onerror = () => finish(open.error);
      open.onblocked = () => finish(new Error('Browser audio storage is blocked'));
      open.onsuccess = () => {
        db = open.result;
        if (settled) {
          db.close();
          return;
        }
        try {
          transaction = db.transaction('audio', mode);
          const request = action(transaction.objectStore('audio'));
          request.onsuccess = () => {
            result = request.result;
          };
          transaction.oncomplete = () => finish();
          transaction.onabort = transaction.onerror = () =>
            finish(transaction.error || new Error('Browser audio storage failed'));
        } catch (error) {
          finish(error);
        }
      };
    } catch (error) {
      finish(error);
    }
  });
}
export async function readCachedAudio(songId) {
  const record = await access('readonly', (store) => store.get(songId));
  if (!record) return null;
  if (!(record.blob instanceof Blob)) throw new Error('Cached audio is missing');
  return new File([record.blob], record.name || songId + '.mp3', { type: record.blob.type });
}
export const cacheAudio = (songId, file) =>
  access('readwrite', (store) => store.put({ songId, blob: file, name: file.name }));
