import { h, toast, formatTime, urlTracker, confirmDialog, backLabel, icon } from '../ui.js';
import { getEntry, saveEntry, deleteEntry, listEntries } from '../db.js';
import { TAGS } from '../config.js';
import { addPhotos, photoButton } from '../capture.js';
import { createDictation } from '../speech.js';

/** One photo with its comment and tag. Every change is saved as you type, so nothing is lost. */
export async function entryScreen(screen, [visitId, entryId], { go }) {
  const entry = await getEntry(entryId);
  if (!entry) { screen.append(h('h1', {}, 'Photo not found'), h('a', { class: 'btn primary', href: `#/visit/${visitId}` }, 'Back to the visit')); return; }
  const urls = urlTracker();
  const all = await listEntries(visitId);
  const number = all.findIndex((e) => e.id === entryId) + 1;

  const saved = h('p', { class: 'muted small', role: 'status', id: 'saved' }, '');
  let timer = null;
  let dirty = false;

  const comment = h('textarea', {
    id: 'comment', value: entry.comment, rows: 5, autocapitalize: 'sentences', placeholder: 'Type what you see…',
    oninput: () => { dirty = true; saved.textContent = ''; clearTimeout(timer); timer = setTimeout(flush, 400); },
    onblur: () => flush(),
  });

  async function flush() {
    clearTimeout(timer);
    if (!dirty) return;
    dirty = false;
    entry.comment = comment.value;
    await saveEntry(visitId, entry);
    saved.textContent = 'Saved on this device ✓';
  }

  // Phones can freeze or close the page at any moment, so save as soon as it is hidden.
  const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', flush);

  const tagButtons = TAGS.map((tag) => h('button', {
    class: 'tagbtn', type: 'button', dataset: { tag: tag.id }, 'aria-pressed': String(entry.tag === tag.id),
    onclick: async () => {
      entry.tag = entry.tag === tag.id ? '' : tag.id;                       // tap again to clear
      tagButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tag === entry.tag)));
      await saveEntry(visitId, entry);
      saved.textContent = 'Saved on this device ✓';
    },
  }, tag.label));

  // Optional microphone: only shown where the browser can do speech recognition.
  const dictation = createDictation({
    onText: (text) => { comment.value = `${comment.value}${comment.value && !/\s$/.test(comment.value) ? ' ' : ''}${text}`; dirty = true; flush(); },
    onState: (on) => { mic.setAttribute('aria-pressed', String(on)); mic.replaceChildren(icon(on ? 'stop' : 'mic', 20), on ? 'Stop listening' : 'Speak instead of typing'); },
    onProblem: (message) => toast(message, 6000),
  });
  const mic = dictation && h('button', { class: 'btn block', type: 'button', 'aria-pressed': 'false', onclick: () => dictation.toggle() }, icon('mic', 20), 'Speak instead of typing');

  async function nextPhoto(files) {
    await flush();
    const { created, failed } = await addPhotos(visitId, files);
    if (failed) toast('That photo could not be read.', 4500);
    if (created.length) go(`#/visit/${visitId}/entry/${created[0].id}`);
  }

  async function remove() {
    const yes = await confirmDialog({ title: 'Delete this photo?', message: 'The photo and its comment will be removed. This cannot be undone.', confirmText: 'Delete it', cancelText: 'Keep it', danger: true });
    if (!yes) return;
    dirty = false;
    await deleteEntry(visitId, entryId);
    toast('Photo deleted');
    go(`#/visit/${visitId}`);
  }

  screen.append(
    h('div', { class: 'topbar' },
      h('a', { class: 'btn ghost back', href: `#/visit/${visitId}`, onclick: () => flush() }, backLabel('Done')),
      h('h1', {}, `Photo ${number}`)),
    h('div', { class: 'stack' },
      h('img', { class: 'bigphoto', src: urls.url(entry.photo), alt: `Photo ${number}, taken at ${formatTime(entry.createdAt)}` }),
      h('label', { class: 'field', for: 'comment' }, h('span', {}, 'Comment'), comment, saved),
      mic,
      h('div', { class: 'field' }, h('span', {}, 'Label (optional)'), h('div', { class: 'tags', role: 'group', 'aria-label': 'Label' }, tagButtons)),
      h('div', { class: 'photo-actions' },
        h('a', { class: 'btn primary big', href: `#/visit/${visitId}`, onclick: () => flush() }, 'Done'),
        photoButton({ label: 'Take next photo', icon: 'camera', camera: true, onFiles: nextPhoto })),
      h('details', {}, h('summary', { class: 'btn' }, 'More'),
        h('div', { class: 'stack', style: 'margin-top:.75rem' }, h('button', { class: 'btn danger block', type: 'button', onclick: remove }, 'Delete this photo')))));

  comment.focus();
  return () => { clearTimeout(timer); flush(); dictation?.stop(); document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', flush); urls.release(); };
}
