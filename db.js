const DB_NAME = 'GeminiExtensionDB';
const DB_VERSION = 2;
let db;

let functions = {};

functions.initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => reject("IndexedDB error: " + event.target.error);

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      db = event.target.result;
      if (!db.objectStoreNames.contains('prompts')) {
        db.createObjectStore('prompts', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('system_prompts')) {
        db.createObjectStore('system_prompts', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('requests')) {
        db.createObjectStore('requests', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
};

functions.saveData = (store_name, data) => {
  return new Promise(async (resolve, reject) => {
    if (!db) {
      await functions.initDB();
    }
    const transaction = db.transaction([store_name], 'readwrite');
    const store = transaction.objectStore(store_name);
    let request;

    if (data.id !== undefined) {
      request = store.put(data);
    } else {
      request = store.add(data);
    }

    request.onerror = (event) => reject(`Error saving ${store_name}: ` + event.target.error);
    request.onsuccess = (event) => resolve(event.target.result);
  });
}

functions.deleteData = (store_name, id) => {
  return new Promise(async (resolve, reject) => {
    if (!db) {
      await functions.initDB();
    }
    const transaction = db.transaction([store_name], 'readwrite');
    const store = transaction.objectStore(store_name);
    const request = store.delete(id);

    request.onerror = (event) => reject(`Error deleting from ${store_name}: ` + event.target.error);
    request.onsuccess = (event) => resolve();
  });
}


functions.getObjectStore = (store_name) => {
  return new Promise(async (resolve, reject) => {
    if (!db) {
      await functions.initDB();
    }
    const transaction = db.transaction([store_name], 'readwrite');
    const store = transaction.objectStore(store_name);
    return store;
  });
}

functions.searchData = (store_name, search_object) => {
  return new Promise(async (resolve, reject) => {
    if (!db) {
      await functions.initDB();
    }
    const transaction = db.transaction([store_name], 'readonly');
    const store = transaction.objectStore(store_name);
    const results = [];
    const request = store.openCursor();

    request.onerror = (event) => reject(`Error searching in ${store_name}: ` + event.target.error);

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const entry = cursor.value;
        let match = true;
        for (const [key, value] of Object.entries(search_object)) {
          if (entry[key] !== value) {
            match = false;
            break;
          }
        }

        if (match) {
          results.push(entry);
        }
        cursor.continue();
      } else {
        // No more entries to iterate
        resolve(results);
      }
    };
  });
};

functions.getAll = (store_name) => {
  return new Promise(async (resolve, reject) => {
    if (!db) {
      await functions.initDB();
    }
    const transaction = db.transaction([store_name], 'readonly');
    const store = transaction.objectStore(store_name);
    const request = store.getAll();

    request.onerror = (event) => reject(`Error getting all ${store_name}: ` + event.target.error);
    request.onsuccess = (event) => resolve(event.target.result);
  });
}

export { functions };