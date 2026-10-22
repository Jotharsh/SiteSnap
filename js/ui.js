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
