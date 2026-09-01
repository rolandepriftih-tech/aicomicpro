/**
 * 本地持久化工具类
 * 小数据用 localStorage，大数据（图片base64）用 IndexedDB
 */

const DB_NAME = "ai-comic-pro-db";
const DB_VERSION = 4;
const ASSET_IMAGES_STORE = "asset-images";
const ASSET_REFERENCE_IMAGES_STORE = "asset-reference-images";
const PANEL_IMAGES_STORE = "panel-images";
const PANEL_REFERENCE_IMAGES_STORE = "panel-reference-images";

/**
 * 初始化 IndexedDB
 */
function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      return reject(new Error("IndexedDB 只能在浏览器环境使用"));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(ASSET_IMAGES_STORE)) {
        db.createObjectStore(ASSET_IMAGES_STORE);
      }
      if (!db.objectStoreNames.contains(ASSET_REFERENCE_IMAGES_STORE)) {
        db.createObjectStore(ASSET_REFERENCE_IMAGES_STORE);
      }
      if (!db.objectStoreNames.contains(PANEL_IMAGES_STORE)) {
        db.createObjectStore(PANEL_IMAGES_STORE);
      }
      if (!db.objectStoreNames.contains(PANEL_REFERENCE_IMAGES_STORE)) {
        db.createObjectStore(PANEL_REFERENCE_IMAGES_STORE);
      }
    };
  });
}

/**
 * IndexedDB 操作包装
 * 关键：必须等待 transaction.oncomplete 才 resolve，否则 put 可能还没落盘
 */
async function withDB<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => Promise<T> | T
): Promise<T> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let result: T;

    Promise.resolve(operation(store))
      .then((val) => {
        result = val;
      })
      .catch(reject);

    transaction.oncomplete = () => {
      db.close();
      resolve(result);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

/**
 * 存储资产图片（IndexedDB）
 */
export async function saveAssetImage(assetName: string, imageUrl: string): Promise<void> {
  await withDB(ASSET_IMAGES_STORE, "readwrite", (store) => {
    store.put(imageUrl, assetName);
  });
}

/**
 * 批量存储资产图片
 */
export async function saveAssetImages(images: Record<string, string>): Promise<void> {
  await withDB(ASSET_IMAGES_STORE, "readwrite", (store) => {
    // 先清除所有旧数据
    store.clear();
    // 再保存新数据
    Object.entries(images).forEach(([name, url]) => {
      store.put(url, name);
    });
  });
}

/**
 * 获取单个资产图片
 */
export async function getAssetImage(assetName: string): Promise<string | undefined> {
  return withDB(ASSET_IMAGES_STORE, "readonly", (store) => {
    return new Promise((resolve, reject) => {
      const request = store.get(assetName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

/**
 * 获取所有资产图片
 */
export async function getAllAssetImages(): Promise<Record<string, string>> {
  return withDB(ASSET_IMAGES_STORE, "readonly", (store) => {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const keys = store.getAllKeys();
        keys.onsuccess = () => {
          const keyList = keys.result as string[];
          const values = request.result as string[];
          const images: Record<string, string> = {};
          keyList.forEach((key, i) => {
            if (values[i]) images[key] = values[i];
          });
          resolve(images);
        };
        keys.onerror = () => reject(keys.error);
      };
      request.onerror = () => reject(request.error);
    });
  });
}

/**
 * 删除单个资产图片
 */
export async function deleteAssetImage(assetName: string): Promise<void> {
  await withDB(ASSET_IMAGES_STORE, "readwrite", (store) => {
    store.delete(assetName);
  });
}

/**
 * 清空所有资产图片
 */
export async function clearAssetImages(): Promise<void> {
  await withDB(ASSET_IMAGES_STORE, "readwrite", (store) => {
    store.clear();
  });
}

/**
 * 存储资产参考图（IndexedDB）
 */
export async function saveAssetReferenceImage(assetName: string, imageUrl: string): Promise<void> {
  await withDB(ASSET_REFERENCE_IMAGES_STORE, "readwrite", (store) => {
    store.put(imageUrl, assetName);
  });
}

/**
 * 批量存储资产参考图
 */
export async function saveAssetReferenceImages(images: Record<string, string>): Promise<void> {
  await withDB(ASSET_REFERENCE_IMAGES_STORE, "readwrite", (store) => {
    // 先清除所有旧数据
    store.clear();
    // 再保存新数据
    Object.entries(images).forEach(([name, url]) => {
      store.put(url, name);
    });
  });
}

/**
 * 获取单个资产参考图
 */
export async function getAssetReferenceImage(assetName: string): Promise<string | undefined> {
  return withDB(ASSET_REFERENCE_IMAGES_STORE, "readonly", (store) => {
    return new Promise((resolve, reject) => {
      const request = store.get(assetName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

/**
 * 获取所有资产参考图
 */
export async function getAllAssetReferenceImages(): Promise<Record<string, string>> {
  return withDB(ASSET_REFERENCE_IMAGES_STORE, "readonly", (store) => {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const keys = store.getAllKeys();
        keys.onsuccess = () => {
          const keyList = keys.result as string[];
          const values = request.result as string[];
          const images: Record<string, string> = {};
          keyList.forEach((key, i) => {
            if (values[i]) images[key] = values[i];
          });
          resolve(images);
        };
        keys.onerror = () => reject(keys.error);
      };
      request.onerror = () => reject(request.error);
    });
  });
}

/**
 * 删除单个资产参考图
 */
export async function deleteAssetReferenceImage(assetName: string): Promise<void> {
  await withDB(ASSET_REFERENCE_IMAGES_STORE, "readwrite", (store) => {
    store.delete(assetName);
  });
}

/**
 * 清空所有资产参考图
 */
export async function clearAssetReferenceImages(): Promise<void> {
  await withDB(ASSET_REFERENCE_IMAGES_STORE, "readwrite", (store) => {
    store.clear();
  });
}

/* ==================== 分镜图片存储（IndexedDB）==================== */

export async function savePanelImage(panelId: string, imageUrl: string): Promise<void> {
  await withDB(PANEL_IMAGES_STORE, "readwrite", (store) => {
    store.put(imageUrl, panelId);
  });
}

export async function savePanelImages(images: Record<string, string>): Promise<void> {
  await withDB(PANEL_IMAGES_STORE, "readwrite", (store) => {
    // 先清除所有旧数据
    store.clear();
    // 再保存新数据
    Object.entries(images).forEach(([id, url]) => {
      store.put(url, id);
    });
  });
}

export async function getPanelImage(panelId: string): Promise<string | undefined> {
  return withDB(PANEL_IMAGES_STORE, "readonly", (store) => {
    return new Promise((resolve, reject) => {
      const request = store.get(panelId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

export async function getAllPanelImages(): Promise<Record<string, string>> {
  return withDB(PANEL_IMAGES_STORE, "readonly", (store) => {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const keys = store.getAllKeys();
        keys.onsuccess = () => {
          const keyList = keys.result as string[];
          const values = request.result as string[];
          const images: Record<string, string> = {};
          keyList.forEach((key, i) => {
            if (values[i]) images[key] = values[i];
          });
          resolve(images);
        };
        keys.onerror = () => reject(keys.error);
      };
      request.onerror = () => reject(request.error);
    });
  });
}

export async function clearPanelImages(): Promise<void> {
  await withDB(PANEL_IMAGES_STORE, "readwrite", (store) => {
    store.clear();
  });
}

/**
 * localStorage 包装（小数据存储）
 */
export const LocalStorage = {
  get<T>(key: string, defaultValue?: T): T | undefined {
    if (typeof window === "undefined") return defaultValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : defaultValue;
    } catch (e) {
      console.error(`读取 localStorage 失败 ${key}:`, e);
      return defaultValue;
    }
  },

  set(key: string, value: any): boolean {
    if (typeof window === "undefined") return false;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`写入 localStorage 失败 ${key}:`, e);
      return false;
    }
  },

  remove(key: string): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      console.error(`删除 localStorage 失败 ${key}:`, e);
    }
  },

  // 直接存储字符串（不用JSON序列化）
  setRaw(key: string, value: string): boolean {
    if (typeof window === "undefined") return false;
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.error(`写入 localStorage 失败 ${key}:`, e);
      return false;
    }
  },

  getRaw(key: string, defaultValue?: string): string | undefined {
    if (typeof window === "undefined") return defaultValue;
    try {
      return window.localStorage.getItem(key) ?? defaultValue;
    } catch (e) {
      console.error(`读取 localStorage 失败 ${key}:`, e);
      return defaultValue;
    }
  }
};

/* ==================== 分镜参考图存储（IndexedDB）==================== */

export async function savePanelReferenceImages(images: Record<string, string>): Promise<void> {
  await withDB(PANEL_REFERENCE_IMAGES_STORE, "readwrite", (store) => {
    store.clear();
    Object.entries(images).forEach(([id, url]) => {
      store.put(url, id);
    });
  });
}

export async function getAllPanelReferenceImages(): Promise<Record<string, string>> {
  return withDB(PANEL_REFERENCE_IMAGES_STORE, "readonly", (store) => {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const keys = store.getAllKeys();
        keys.onsuccess = () => {
          const keyList = keys.result as string[];
          const values = request.result as string[];
          const images: Record<string, string> = {};
          keyList.forEach((key, i) => {
            if (values[i]) images[key] = values[i];
          });
          resolve(images);
        };
        keys.onerror = () => reject(keys.error);
      };
      request.onerror = () => reject(request.error);
    });
  });
}

export async function clearPanelReferenceImages(): Promise<void> {
  await withDB(PANEL_REFERENCE_IMAGES_STORE, "readwrite", (store) => {
    store.clear();
  });
}
