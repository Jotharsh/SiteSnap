// Everything lives in IndexedDB on this device. No server, no account.
import { DEFAULT_SETTINGS } from './config.js';

const DB_NAME = 'sitesnap';
const DB_VERSION = 1;
let dbPromise;

export function openDB() {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('visits', { keyPath: 'id' });
      const entries = db.createObjectStore('entries', { keyPath: 'id' });
      entries.createIndex('byVisit', 'visitId');
      db.createObjectStore('settings', { keyPath: 'key' });
      db.createObjectStore('meta', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('The database is open in another tab. Close other SiteSnap tabs and try again.'));
  });
  return dbPromise;
}

const wrap = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

/** Runs `work(stores)` inside one transaction and resolves with its result once the transaction has committed. */
async function transact(names, mode, work) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(names, mode);
    const stores = Object.fromEntries(names.map((n) => [n, t.objectStore(n)]));
    let result;
    Promise.resolve(work(stores)).then((r) => { result = r; }, (e) => { try { t.abort(); } catch {} reject(e); });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error('Saving was cancelled.'));
  });
}

export const newId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

// ---- visits ----
export async function listVisits() {
  const all = await transact(['visits'], 'readonly', ({ visits }) => wrap(visits.getAll()));
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}
export const getVisit = (id) => transact(['visits'], 'readonly', ({ visits }) => wrap(visits.get(id)));

export async function saveVisit(visit) {
  const now = Date.now();
  const record = { ...visit, createdAt: visit.createdAt ?? now, updatedAt: now };
  await transact(['visits'], 'readwrite', ({ visits }) => wrap(visits.put(record)));
  return record;
}

/**
 * Changes just the named fields of a visit, reading the current record inside the same transaction.
 * Use this instead of saveVisit() when only part of the visit changed, so a screen holding an older copy can never overwrite newer data.
 */
export async function patchVisit(id, patch) {
  return transact(['visits'], 'readwrite', async ({ visits }) => {
    const current = await wrap(visits.get(id));
    if (!current) return null;
    const record = { ...current, ...patch, updatedAt: Date.now() };
    visits.put(record);
    return record;
  });
}

export async function deleteVisit(id) {
  await transact(['visits', 'entries'], 'readwrite', async ({ visits, entries }) => {
    const keys = await wrap(entries.index('byVisit').getAllKeys(id));
    for (const key of keys) entries.delete(key);
    visits.delete(id);
  });
}

// ---- entries (one photo + comment each) ----
export async function listEntries(visitId) {
  const all = await transact(['entries'], 'readonly', ({ entries }) => wrap(entries.index('byVisit').getAll(visitId)));
  return all.sort((a, b) => a.order - b.order);
}
export const getEntry = (id) => transact(['entries'], 'readonly', ({ entries }) => wrap(entries.get(id)));
export const countEntries = (visitId) => transact(['entries'], 'readonly', ({ entries }) => wrap(entries.index('byVisit').count(visitId)));

export async function firstEntry(visitId) {
  const all = await listEntries(visitId);
  return all[0] ?? null;
}

/** Adds or updates entries and bumps the visit's "last changed" time, in one transaction (autosave). */
export async function saveEntries(visitId, list) {
  await transact(['entries', 'visits'], 'readwrite', async ({ entries, visits }) => {
    for (const entry of list) entries.put({ ...entry, visitId });
    const visit = await wrap(visits.get(visitId));
    if (visit) visits.put({ ...visit, updatedAt: Date.now() });
  });
}
export const saveEntry = (visitId, entry) => saveEntries(visitId, [entry]);

export async function appendEntry(visitId, fields) {
  return transact(['entries', 'visits'], 'readwrite', async ({ entries, visits }) => {
    const existing = await wrap(entries.index('byVisit').getAll(visitId));
    const order = existing.reduce((m, e) => Math.max(m, e.order), -1) + 1;
    const entry = { id: newId(), visitId, order, comment: '', tag: '', createdAt: Date.now(), ...fields };
    entries.put(entry);
    const visit = await wrap(visits.get(visitId));
    if (visit) visits.put({ ...visit, updatedAt: Date.now() });
    return entry;
  });
}

export async function deleteEntry(visitId, id) {
  await transact(['entries', 'visits'], 'readwrite', async ({ entries, visits }) => {
    entries.delete(id);
    const visit = await wrap(visits.get(visitId));
    if (visit) visits.put({ ...visit, updatedAt: Date.now() });
  });
}

/** Renumbers entries 0..n-1 in the given order. */
export async function reorderEntries(visitId, orderedIds) {
  await transact(['entries'], 'readwrite', async ({ entries }) => {
    for (let i = 0; i < orderedIds.length; i++) {
      const entry = await wrap(entries.get(orderedIds[i]));
      if (entry && entry.order !== i) entries.put({ ...entry, order: i });
    }
  });
}

export async function duplicateVisit(id, withEntries) {
  const source = await getVisit(id);
  const { reportNo, ...details } = source;                  // a copy is a new report: it gets its own number
  const copy = { ...details, id: newId(), project: `${source.project} (copy)`, remarks: '', createdAt: Date.now() };
  const record = await saveVisit(copy);
  if (withEntries) {
    const list = await listEntries(id);
    await saveEntries(record.id, list.map((e) => ({ ...e, id: newId() })));
  }
  return record;
}

// ---- settings and counters ----
export async function getSettings() {
  const rows = await transact(['settings'], 'readonly', ({ settings }) => wrap(settings.getAll()));
  return { ...DEFAULT_SETTINGS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) };
}
export async function setSettings(patch) {
  await transact(['settings'], 'readwrite', ({ settings }) => {
    for (const [key, value] of Object.entries(patch)) settings.put({ key, value });
  });
}

/** Next report number for a year, e.g. "SR-2026-007". The counter is incremented atomically. */
export async function nextReportNumber(year = new Date().getFullYear()) {
  const n = await transact(['meta'], 'readwrite', async ({ meta }) => {
    const row = await wrap(meta.get(`reports-${year}`));
    const next = (row?.value ?? 0) + 1;
    meta.put({ key: `reports-${year}`, value: next });
    return next;
  });
  return `SR-${year}-${String(n).padStart(3, '0')}`;
}

/** Asks the browser not to evict our data when storage is tight. Returns whether it was granted. */
export async function requestPersistence() {
  try { return (await navigator.storage?.persist?.()) ?? false; } catch { return false; }
}
