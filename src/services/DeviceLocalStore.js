/**
 * DeviceLocalStore.js
 * Gerätespezifischer, robuster lokaler Entwurfs- und Revisionsspeicher für QTool.
 * Speichert unumstößliche Snapshots vor jedem Netzwerk-Request in IndexedDB / LocalStorage.
 * Bietet 2-Stufen Lese-Verifikation mit Content-Hashing und per-Revisions-Bereinigung.
 */

const DB_NAME = 'qtool_device_drafts_db';
const STORE_NAME = 'snapshots';
const LOCALSTORAGE_PREFIX = 'qservice_device_draft_';

function calculateContentHash(obj) {
  try {
    const str = JSON.stringify(obj || {});
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    return `h_${Math.abs(hash)}_${str.length}`;
  } catch (e) {
    return 'HASH_ERR';
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('projectId', 'projectId', { unique: false });
        store.createIndex('userId', 'userId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function countTotalMeasurements(reportData) {
  let count = 0;
  if (!reportData) return 0;
  const mRooms = Array.isArray(reportData.measurementRooms) ? reportData.measurementRooms : [];
  mRooms.forEach(mr => {
    if (Array.isArray(mr.measurements)) count += mr.measurements.length;
    if (Array.isArray(mr.measurementHistory)) {
      mr.measurementHistory.forEach(h => {
        if (Array.isArray(h.points)) count += h.points.length;
      });
    }
  });
  return count;
}

/**
 * Erzeugt einen lokal gesicherten Revisions-Snapshot mit Content-Hash
 */
export async function saveSnapshot(projectId, userId, reportData) {
  if (!projectId) throw new Error('saveSnapshot requires projectId');
  const cleanUserId = String(userId || 'anonymous').trim();
  const revId = `rev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const totalRooms = Array.isArray(reportData?.rooms) ? reportData.rooms.length : 0;
  const totalMeasurementRooms = Array.isArray(reportData?.measurementRooms) ? reportData.measurementRooms.length : 0;
  const totalPoints = countTotalMeasurements(reportData);
  const contentHash = calculateContentHash(reportData);

  const snapshot = {
    key: `${projectId}_${cleanUserId}_${revId}`,
    projectId,
    userId: cleanUserId,
    revId,
    timestamp: new Date().toISOString(),
    version: reportData?.version || 1,
    data: JSON.parse(JSON.stringify(reportData || {})),
    meta: {
      totalRooms,
      totalMeasurementRooms,
      totalPoints,
      contentHash
    }
  };

  // 1. Write to IndexedDB
  let writtenOk = false;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    await new Promise((res, rej) => {
      const req = store.put(snapshot);
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    });
    writtenOk = true;
  } catch (idbErr) {
    console.warn('[DeviceLocalStore] IndexedDB write failed, falling back to LocalStorage:', idbErr.message);
  }

  // 2. Fallback / Sync to LocalStorage
  try {
    const lsKey = `${LOCALSTORAGE_PREFIX}${projectId}_${cleanUserId}`;
    const existingRaw = localStorage.getItem(lsKey);
    let existingList = [];
    if (existingRaw) {
      try { existingList = JSON.parse(existingRaw); } catch (e) {}
    }
    if (!Array.isArray(existingList)) existingList = [];
    existingList.push(snapshot);
    if (existingList.length > 10) existingList = existingList.slice(-10);
    localStorage.setItem(lsKey, JSON.stringify(existingList));
    writtenOk = true;
  } catch (lsErr) {
    console.warn('[DeviceLocalStore] LocalStorage write failed:', lsErr.message);
  }

  return { success: writtenOk, revId, snapshot };
}

/**
 * Liest den gespeicherten Entwurf wieder aus und verifiziert Content-Hash & Kernfelder
 */
export async function verifyLocalDraft(projectId, userId, revId) {
  if (!projectId || !revId) return false;
  const cleanUserId = String(userId || 'anonymous').trim();
  let foundSnapshot = null;

  // Read from IndexedDB
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const key = `${projectId}_${cleanUserId}_${revId}`;
    foundSnapshot = await new Promise((res) => {
      const req = store.get(key);
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => res(null);
    });
  } catch (e) {}

  // Read from LocalStorage fallback if not in IndexedDB
  if (!foundSnapshot) {
    try {
      const lsKey = `${LOCALSTORAGE_PREFIX}${projectId}_${cleanUserId}`;
      const raw = localStorage.getItem(lsKey);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          foundSnapshot = list.find(s => s.revId === revId) || null;
        }
      }
    } catch (e) {}
  }

  if (!foundSnapshot) return false;

  // Check Core Assertions
  const matchProject = String(foundSnapshot.projectId) === String(projectId);
  const matchUser = String(foundSnapshot.userId) === cleanUserId;
  const matchRev = String(foundSnapshot.revId) === String(revId);
  const hasData = !!foundSnapshot.data;

  const currentHash = calculateContentHash(foundSnapshot.data);
  const expectedHash = foundSnapshot.meta?.contentHash;
  const matchHash = expectedHash ? currentHash === expectedHash : true;

  return matchProject && matchUser && matchRev && hasData && matchHash;
}

/**
 * Entfernt gezielt NUR eine bestätigte Revisions-ID nach 5-Punkte-Datenbankbestätigung
 */
export async function purgeSnapshot(projectId, userId, confirmedRevId) {
  if (!projectId || !confirmedRevId) return;
  const cleanUserId = String(userId || 'anonymous').trim();

  // 1. Purge from IndexedDB
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const key = `${projectId}_${cleanUserId}_${confirmedRevId}`;
    store.delete(key);
  } catch (e) {}

  // 2. Purge from LocalStorage
  try {
    const lsKey = `${LOCALSTORAGE_PREFIX}${projectId}_${cleanUserId}`;
    const raw = localStorage.getItem(lsKey);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const nextList = list.filter(s => s.revId !== confirmedRevId);
        if (nextList.length > 0) {
          localStorage.setItem(lsKey, JSON.stringify(nextList));
        } else {
          localStorage.removeItem(lsKey);
        }
      }
    }
  } catch (e) {}
}

/**
 * Holt den neuesten unbestätigten Entwurf für das Projekt auf diesem Gerät
 */
export async function getUnconfirmedDraft(projectId, userId) {
  if (!projectId) return null;
  const cleanUserId = String(userId || 'anonymous').trim();
  let snapshots = [];

  // Read IndexedDB
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('projectId');
    snapshots = await new Promise((res) => {
      const req = index.getAll(projectId);
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => res([]);
    });
  } catch (e) {}

  // Read LocalStorage
  if (snapshots.length === 0) {
    try {
      const lsKey = `${LOCALSTORAGE_PREFIX}${projectId}_${cleanUserId}`;
      const raw = localStorage.getItem(lsKey);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) snapshots = list;
      }
    } catch (e) {}
  }

  // Filter by userId and sort newest timestamp first
  const userSnapshots = snapshots.filter(s => String(s.userId) === cleanUserId);
  if (userSnapshots.length === 0) return null;

  userSnapshots.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return userSnapshots[0];
}
