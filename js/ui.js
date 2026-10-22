// Tiny helpers so every screen is plain DOM, with no framework and no build step.
export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key in node && key !== 'list' && key !== 'form') node[key] = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function toast(message, ms = 2800) {
  const host = document.getElementById('toasts');
  const node = h('div', { class: 'toast' }, message);
  host.append(node);
  setTimeout(() => node.remove(), ms);
}

function openDialog(content) {
  return new Promise((resolve) => {
    const dialog = h('dialog', {}, content(resolve));
    dialog.addEventListener('close', () => { dialog.remove(); resolve(dialog.returnValue || null); });
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    document.body.append(dialog);
    dialog.showModal();
  });
}

/** A yes/no question. Resolves true only if the user chose the main button. */
export async function confirmDialog({ title, message = '', confirmText = 'Yes', cancelText = 'Cancel', danger = false }) {
  const result = await openDialog(() => [
    h('h2', {}, title),
    message && h('p', {}, message),
    h('div', { class: 'actions' },
      h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, onclick: (e) => e.target.closest('dialog').close('yes') }, confirmText),
      h('button', { class: 'btn', onclick: (e) => e.target.closest('dialog').close('no'), autofocus: true }, cancelText)),
  ]);
  return result === 'yes';
}

/** A list of big buttons. Resolves with the chosen action's id, or null if dismissed. */
export function sheet({ title, message = '', actions }) {
  return openDialog(() => [
    h('h2', {}, title),
    message && h('p', { class: 'muted' }, message),
    h('div', { class: 'actions' },
      actions.map((a) => h('button', { class: `btn ${a.danger ? 'danger' : a.primary ? 'primary' : ''}`, onclick: (e) => e.target.closest('dialog').close(a.id) }, a.label)),
      h('button', { class: 'btn ghost', onclick: (e) => e.target.closest('dialog').close('') }, 'Close')),
  ]);
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const TIME_FORMAT = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
/** Accepts a Date, a timestamp, or "YYYY-MM-DD" (treated as a local date, so it never shifts by a day). */
export function formatDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return DATE_FORMAT.format(new Date(y, m - 1, d));
  }
  return DATE_FORMAT.format(new Date(value));
}
export const formatTime = (value) => TIME_FORMAT.format(new Date(value));
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Object URLs for Blobs, all released together when a screen is left. */
export function urlTracker() {
  const urls = [];
  return {
    url(blob) { if (!blob) return ''; const u = URL.createObjectURL(blob); urls.push(u); return u; },
    release() { urls.splice(0).forEach((u) => URL.revokeObjectURL(u)); },
  };
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  camera: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.2-1.7a1 1 0 0 1 .8-.3h4a1 1 0 0 1 .8.3L16 6h1.5A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.4"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M20.5 16l-5-5-9 8.5"/>',
  mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="1.5"/>',
  back: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
  dots: '<circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/>',
  share: '<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12"/>',
  download: '<path d="M12 4v11M8 11l4 4 4-4"/><path d="M5 19.5h14"/>',
  file: '<path d="M7 3.5h6.5L18 8v11.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z"/><path d="M13.5 3.5V8H18M9 13h6M9 16.5h6"/>',
};

/** A small line icon. The shapes above are fixed text written in this file, never user input. */
export function icon(name, size = 22) {
  const span = document.createElement('span');
  span.className = 'icon';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
  return span;
}
export const backLabel = (text) => [icon('back', 20), text];
