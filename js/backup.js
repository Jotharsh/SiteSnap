// Back up a visit to a file, and open one again. A backup holds the photos too, so it can be much larger than the PDF.
import { getVisit, listEntries, listVisits, saveVisit, saveEntries, newId } from './db.js';
import { makeThumbnail } from './image.js';
import { TAGS } from './config.js';
import { todayISO } from './ui.js';

const FORMAT = 'sitesnap-visit';
const VERSION = 1;
const MAX_FILE_BYTES = 300 * 1024 * 1024;
const MAX_ENTRIES = 1000;
const MAX_COMMENT = 20000;

export class BackupError extends Error {}

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

function dataUrlToBlob(url) {
  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/.exec(typeof url === 'string' ? url : '');
  if (!match) throw new BackupError('A photo inside this file is not valid.');
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: match[1] });
}

const slug = (s) => s.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'visit';

/** @returns {Promise<File>} a backup of one visit with all its photos and comments */
export async function exportVisit(visitId) {
  const visit = await getVisit(visitId);
  if (!visit) throw new BackupError('That visit could not be found.');
  const entries = await listEntries(visitId);
  const payload = {
    format: FORMAT, version: VERSION, app: 'SiteSnap', exportedAt: new Date().toISOString(),
    visit: { project: visit.project, location: visit.location ?? '', date: visit.date, preparedBy: visit.preparedBy ?? '', remarks: visit.remarks ?? '', reportNo: visit.reportNo ?? '' },
    entries: await Promise.all(entries.map(async (e) => ({
      comment: e.comment, tag: e.tag, createdAt: e.createdAt, width: e.width, height: e.height, photo: await blobToDataUrl(e.photo),
    }))),
  };
  return new File([JSON.stringify(payload)], `SiteSnap-backup_${slug(visit.project)}_${visit.date}.sitesnap.json`, { type: 'application/json' });
}

const text = (value, max, fallback = '') => (typeof value === 'string' ? value.slice(0, max) : fallback);

/**
 * Reads a backup file and adds it as a NEW visit (it never overwrites anything you already have).
 * The file is treated as untrusted: its shape, sizes and photos are all checked first.
 */
export async function importVisit(file) {
  if (file.size > MAX_FILE_BYTES) throw new BackupError('This file is too large to be a SiteSnap backup.');
  let data;
  try { data = JSON.parse(await file.text()); } catch { throw new BackupError('This is not a SiteSnap backup file.'); }
  if (!data || data.format !== FORMAT) throw new BackupError('This is not a SiteSnap backup file.');
  if (data.version !== VERSION) throw new BackupError('This backup was made by a different version of SiteSnap and cannot be opened.');
  if (!data.visit || typeof data.visit.project !== 'string' || !data.visit.project.trim()) throw new BackupError('This backup has no project name, so it cannot be opened.');
  if (!Array.isArray(data.entries) || data.entries.length > MAX_ENTRIES) throw new BackupError('This backup has an unexpected number of photos.');

  const prepared = [];
  for (const [index, raw] of data.entries.entries()) {
    if (!raw || typeof raw !== 'object') throw new BackupError('A photo inside this file is not valid.');
    const photo = dataUrlToBlob(raw.photo);
    let thumb, width, height;
    try { ({ thumb, width, height } = await makeThumbnail(photo)); } catch { throw new BackupError('A photo inside this file is damaged.'); }
    prepared.push({
      id: newId(), order: index, photo, thumb, width, height,
      comment: text(raw.comment, MAX_COMMENT), tag: TAGS.some((t) => t.id === raw.tag) ? raw.tag : '',
      createdAt: Number.isFinite(raw.createdAt) && raw.createdAt > 946684800000 ? raw.createdAt : Date.now(),
    });
  }

  const v = data.visit;
  const existing = await listVisits();
  const reportNo = /^SR-\d{4}-\d{3,}$/.test(v.reportNo ?? '') && !existing.some((x) => x.reportNo === v.reportNo) ? v.reportNo : undefined;
  const visit = await saveVisit({
    id: newId(), project: text(v.project, 200).trim(), location: text(v.location, 200), preparedBy: text(v.preparedBy, 120),
    date: /^\d{4}-\d{2}-\d{2}$/.test(v.date ?? '') ? v.date : todayISO(), remarks: text(v.remarks, MAX_COMMENT),
    ...(reportNo ? { reportNo } : {}),
  });
  await saveEntries(visit.id, prepared);
  return { visit, count: prepared.length };
}
