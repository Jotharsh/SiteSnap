import { h } from './ui.js';

export const canShareFile = (file) => Boolean(navigator.canShare?.({ files: [file] }) && navigator.share);

/** Opens the system share sheet. Returns false if the user closed it without sharing. */
export async function shareFile(file, details = {}) {
  try {
    await navigator.share({ files: [file], ...details });
    return true;
  } catch (error) {
    if (error?.name === 'AbortError') return false;
    throw error;
  }
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = h('a', { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
