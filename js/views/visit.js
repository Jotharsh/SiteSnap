import { h, toast, formatDate, formatTime, plural, urlTracker, confirmDialog, sheet, backLabel, icon } from '../ui.js';
import { getVisit, listEntries, deleteVisit, reorderEntries } from '../db.js';
import { addPhotos, photoButton } from '../capture.js';
import { tagLabel } from '../config.js';
import { exportVisit } from '../backup.js';
import { canShareFile, shareFile, downloadBlob } from '../files.js';

const notFound = (screen) => screen.append(h('h1', {}, 'Visit not found'), h('a', { class: 'btn primary', href: '#/' }, 'Go to home'));

export async function visitScreen(screen, [id], { go }) {
  const visit = await getVisit(id);
  if (!visit) { notFound(screen); return; }
  const urls = urlTracker();
  let entries = await listEntries(id);
  let reordering = false;

  const status = h('p', { class: 'muted', role: 'status', hidden: true });
  const list = h('ol', { class: 'stack entries' });
  const reorderButton = h('button', { class: 'btn', onclick: () => { reordering = !reordering; draw(); } });
  const pdfButton = h('button', { class: 'btn primary big', onclick: makePdf });

  async function handleFiles(files, fromGallery) {
    status.hidden = false;
    const { created, failed } = await addPhotos(id, files, {
      fromGallery,
      onProgress: (n, total) => { status.textContent = total > 1 ? `Saving photo ${n} of ${total}…` : 'Saving photo…'; },
    });
    status.hidden = true;
    if (failed) toast(failed === 1 ? 'One photo could not be read.' : `${failed} photos could not be read.`, 4500);
    if (created.length) go(`#/visit/${id}/entry/${created[0].id}`);   // straight to the comment box
  }

  function makePdf() {
    if (!entries.length) { toast('Add at least one photo first.'); return; }
    go(`#/visit/${id}/pdf`);
  }

  async function move(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= entries.length) return;
    [entries[index], entries[target]] = [entries[target], entries[index]];
    await reorderEntries(id, entries.map((e) => e.id));
    draw();
  }

  function draw() {
    urls.release();
    list.replaceChildren();
    if (!entries.length) list.append(h('li', { class: 'muted' }, 'No photos yet. Tap "Take photo" to add the first one.'));
    entries.forEach((entry, index) => {
      const comment = entry.comment.trim();
      list.append(h('li', { class: 'card entry' },
        h('a', { class: 'open', href: `#/visit/${id}/entry/${entry.id}` },       // its spoken name is simply its visible text: number, comment, label, time
          h('span', { class: 'num' }, index + 1),
          h('img', { class: 'thumb', src: urls.url(entry.thumb), alt: '' }),
          h('span', { class: 'grow' },
            h('span', { class: comment ? 'comment' : 'comment muted' }, comment || 'No comment yet'),
            h('span', { class: 'meta' },
              entry.tag && h('span', { class: `tag ${entry.tag}` }, tagLabel(entry.tag)),
              h('span', { class: 'muted small' }, formatTime(entry.createdAt))))),
        reordering && h('div', { class: 'reorder' },
          h('button', { class: 'btn', disabled: index === 0, 'aria-label': `Move observation ${index + 1} up`, onclick: () => move(index, -1) }, '↑'),
          h('button', { class: 'btn', disabled: index === entries.length - 1, 'aria-label': `Move observation ${index + 1} down`, onclick: () => move(index, 1) }, '↓'))));
    });
    reorderButton.textContent = reordering ? 'Done ordering' : 'Change order';
    reorderButton.hidden = entries.length < 2;
    pdfButton.textContent = 'Make PDF';
    pdfButton.setAttribute('aria-disabled', String(!entries.length));
  }

  /** A backup file holds the photos too. Keep it somewhere safe: Files, email to yourself, or cloud storage. */
  async function backUp() {
    try {
      const file = await exportVisit(id);
      if (canShareFile(file)) {
        const how = await sheet({
          title: 'Back up this visit',
          message: 'The file contains all the photos and comments. Save it to Files, or send it to yourself.',
          actions: [{ id: 'share', label: 'Share the backup file', primary: true }, { id: 'download', label: 'Download the backup file' }],
        });
        if (how === 'share') await shareFile(file, { title: file.name });
        if (how === 'download') { downloadBlob(file, file.name); toast('Backup saved. Look in your Downloads or Files.', 5000); }
      } else {
        downloadBlob(file, file.name);
        toast('Backup saved. Look in your Downloads or Files.', 5000);
      }
    } catch (error) {
      console.error(error);
      toast('The backup could not be made. Please try again.', 5000);
    }
  }

  async function more() {
    const choice = await sheet({
      title: 'More', actions: [
        { id: 'edit', label: 'Change visit details' },
        { id: 'backup', label: 'Back up this visit' },
        { id: 'delete', label: 'Delete this visit', danger: true },
      ],
    });
    if (choice === 'edit') go(`#/visit/${id}/edit`);
    if (choice === 'backup') await backUp();
    if (choice === 'delete') {
      const yes = await confirmDialog({
        title: 'Delete this visit?', message: `"${visit.project}" and all its photos will be removed from this device. This cannot be undone.`,
        confirmText: 'Delete it', cancelText: 'Keep it', danger: true,
      });
      if (yes) { await deleteVisit(id); toast('Visit deleted'); go('#/'); }
    }
  }

  screen.append(
    h('div', { class: 'topbar' },
      h('a', { class: 'btn ghost back', href: '#/' }, backLabel('Home')),
      h('h1', {}, visit.project),
      h('button', { class: 'btn ghost', onclick: more }, 'More')),
    h('div', { class: 'stack' },
      h('p', { class: 'muted' }, [visit.location, formatDate(visit.date), visit.preparedBy && `by ${visit.preparedBy}`].filter(Boolean).join(' · ')),
      h('div', { class: 'photo-actions' },
        photoButton({ label: 'Take photo', icon: 'camera', camera: true, primary: true, onFiles: (f) => handleFiles(f, false) }),
        photoButton({ label: 'Choose from gallery', icon: 'image', onFiles: (f) => handleFiles(f, true) })),
      status,
      h('div', { class: 'row' }, h('h2', { class: 'grow section' }, 'Photos'), reorderButton),
      list),
    h('div', { class: 'bottombar' }, pdfButton));
  draw();
  return () => urls.release();
}
