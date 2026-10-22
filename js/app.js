import { h, toast } from './ui.js';
import { applyAccent } from './theme.js';
import { home } from './views/home.js';
import { more, help, privacy } from './views/more.js';
import { newVisit, editVisit } from './views/visitForm.js';
import { visitScreen } from './views/visit.js';
import { entryScreen } from './views/entry.js';
import { pdfScreen } from './views/pdf.js';
import { settingsScreen } from './views/settings.js';

/** Routes are hash based (#/visit/123) so they work on any static host and inside an installed app. */
const routes = [
  { pattern: /^#\/?$/, view: home },
  { pattern: /^#\/more$/, view: more },
  { pattern: /^#\/help$/, view: help },
  { pattern: /^#\/privacy$/, view: privacy },
  { pattern: /^#\/settings$/, view: settingsScreen },
  { pattern: /^#\/new$/, view: newVisit },
  { pattern: /^#\/visit\/([^/]+)$/, view: visitScreen },
  { pattern: /^#\/visit\/([^/]+)\/edit$/, view: editVisit },
  { pattern: /^#\/visit\/([^/]+)\/entry\/([^/]+)$/, view: entryScreen },
  { pattern: /^#\/visit\/([^/]+)\/pdf$/, view: pdfScreen },
];

export function register(pattern, view) { routes.push({ pattern, view }); }
export function go(path) { location.hash = path; }

const root = document.getElementById('app');
let cleanup = null;
let renderToken = 0;

async function render() {
  const token = ++renderToken;
  try { cleanup?.(); } catch (e) { console.error(e); }
  cleanup = null;
  const hash = location.hash || '#/';
  const match = routes.map((r) => ({ r, m: hash.match(r.pattern) })).find((x) => x.m);
  const screen = h('main', { class: 'screen', id: 'main' });
  root.replaceChildren(screen);
  window.scrollTo(0, 0);
  if (!match) {
    screen.append(h('h1', {}, 'Page not found'), h('a', { class: 'btn primary', href: '#/' }, 'Go to home'));
    return;
  }
  try {
    const result = await match.r.view(screen, match.m.slice(1).map(decodeURIComponent), { go });
    if (token !== renderToken) { result?.(); return; }   // user navigated away while this screen was loading
    cleanup = result ?? null;
  } catch (error) {
    console.error(error);
    screen.replaceChildren(
      h('h1', {}, 'Something went wrong'),
      h('p', {}, 'Your visits are safe. Please go back to the home screen and try again.'),
      h('a', { class: 'btn primary', href: '#/' }, 'Go to home'));
  }
}

window.addEventListener('hashchange', render);
window.addEventListener('unhandledrejection', (e) => { console.error(e.reason); toast('Something went wrong. Please try again.'); });

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const hadController = Boolean(navigator.serviceWorker.controller);
    await navigator.serviceWorker.register('sw.js');
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Only announce real updates, not the very first install.
      if (hadController) toast('SiteSnap was updated. Close and reopen it to use the new version.', 6000);
    });
  } catch (error) {
    console.warn('Offline support could not start:', error);
  }
}

await applyAccent();
await render();
registerServiceWorker();
