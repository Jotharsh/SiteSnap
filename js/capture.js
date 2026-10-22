import { h, icon as svgIcon } from './ui.js';
import { processPhoto } from './image.js';
import { appendEntry, requestPersistence } from './db.js';

/**
 * Compresses each photo and saves it as a new entry straight away, so nothing is lost if the tab closes.
 * Photos are handled one at a time: phones run out of memory if several big photos are decoded together.
 */
export async function addPhotos(visitId, files, { fromGallery = false, onProgress } = {}) {
  const created = [];
  let failed = 0;
  const list = [...files];
  for (let i = 0; i < list.length; i++) {
    onProgress?.(i + 1, list.length);
    try {
      const processed = await processPhoto(list[i]);
      // A gallery photo keeps the time it was taken; a camera photo was taken just now.
      const takenAt = fromGallery && list[i].lastModified > 946684800000 ? list[i].lastModified : Date.now();
      created.push(await appendEntry(visitId, { ...processed, createdAt: takenAt }));
    } catch (error) {
      console.error(error);
      failed++;
    }
  }
  if (created.length) requestPersistence();
  return { created, failed };
}

/** A big button that opens the camera (or the gallery) and hands the chosen files to `onFiles`. */
export function photoButton({ label, icon, camera = false, primary = false, onFiles }) {
  const input = h('input', {
    type: 'file', accept: 'image/*', class: 'sr-only', multiple: !camera,
    ...(camera ? { capture: 'environment' } : {}),
    onchange: () => { const files = [...input.files]; input.value = ''; if (files.length) onFiles(files); },
  });
  return h('label', { class: `btn big ${primary ? 'primary' : ''}` },
    svgIcon(icon, 24), label, input);
}
