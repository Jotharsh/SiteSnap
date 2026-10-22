import { h, toast, urlTracker } from '../ui.js';
import { getSettings, setSettings, requestPersistence } from '../db.js';
import { processBrandImage } from '../image.js';
import { applyAccent } from '../theme.js';

const SWATCHES = [
  ['#c2410c', 'Orange'], ['#b91c1c', 'Red'], ['#a16207', 'Gold'], ['#15803d', 'Green'],
  ['#0f766e', 'Teal'], ['#1d4ed8', 'Blue'], ['#7e22ce', 'Purple'], ['#111111', 'Black'],
];
const LAYOUTS = [[1, 'One per page'], [2, 'Two per page'], [4, 'Four per page']];
const PAPERS = [['a4', 'A4'], ['letter', 'Letter']];

export async function settingsScreen(screen) {
  const settings = await getSettings();
  const urls = urlTracker();
  const status = h('p', { class: 'muted small', role: 'status', id: 'settings-status' }, 'Changes are saved as you make them.');
  let statusTimer;
  const saved = async (patch) => {
    Object.assign(settings, patch);
    await setSettings(patch);
    status.textContent = 'Saved ✓';
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { status.textContent = 'Changes are saved as you make them.'; }, 2000);
  };

  const text = (label, key, { placeholder = '', autocomplete = 'off', hint } = {}) => {
    let timer;
    const input = h('input', {
      type: 'text', id: `s-${key}`, value: settings[key] ?? '', placeholder, autocomplete, autocapitalize: 'words',
      oninput: () => { clearTimeout(timer); timer = setTimeout(() => saved({ [key]: input.value.trim() }), 400); },
      onblur: () => { clearTimeout(timer); saved({ [key]: input.value.trim() }); },
    });
    return h('label', { class: 'field' }, h('span', {}, label), input, hint && h('small', {}, hint));
  };

  const choice = (name, options, key, value) => {
    const buttons = options.map(([v, label]) => h('button', {
      class: 'tagbtn', type: 'button', dataset: { value: v }, 'aria-pressed': String(v === value),
      onclick: () => { buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn(v)))); saved({ [key]: v }); },
    }, label));
    const btn = (v) => buttons.find((b) => b.dataset.value === String(v));
    return h('div', { class: `tags ${options.length === 3 ? 'three' : ''}`, role: 'group', 'aria-label': name }, buttons);
  };

  // A logo or a signature: preview, choose, remove.
  const picture = ({ key, title, help, maxSide, signature }) => {
    const preview = h('div', { class: 'preview checker' });
    const draw = () => {
      preview.replaceChildren(settings[key]
        ? h('img', { src: urls.url(settings[key]), alt: `${title} preview` })
        : h('span', { class: 'muted' }, 'None chosen'));
      remove.hidden = !settings[key];
      choose.firstChild.textContent = settings[key] ? `Replace ${title.toLowerCase()}` : `Choose ${title.toLowerCase()}`;
    };
    const input = h('input', {
      type: 'file', accept: 'image/*', class: 'sr-only',
      onchange: async () => {
        const file = input.files[0];
        input.value = '';
        if (!file) return;
        try {
          await saved({ [key]: await processBrandImage(file, { maxSide, signature }) });
          draw();
        } catch (error) {
          console.error(error);
          toast('That picture could not be read. Please try another one.', 5000);
        }
      },
    });
    const choose = h('label', { class: 'btn' }, h('span', {}), input);
    const remove = h('button', { class: 'btn danger', type: 'button', onclick: async () => { await saved({ [key]: null }); draw(); } }, 'Remove');
    draw();
    return h('div', { class: 'card stack' }, h('h2', {}, title), h('p', { class: 'muted' }, help), preview, h('div', { class: 'row' }, choose, remove));
  };

  // Accent colour: a few good choices, plus any colour.
  const swatches = SWATCHES.map(([hex, name]) => h('button', {
    class: 'swatch', type: 'button', style: `--c:${hex}`, 'aria-label': name, 'aria-pressed': String(settings.accent.toLowerCase() === hex), dataset: { hex },
    onclick: () => setAccent(hex),
  }));
  const custom = h('input', { type: 'color', id: 'accent-custom', value: settings.accent, 'aria-label': 'Choose another colour', oninput: () => setAccent(custom.value) });
  async function setAccent(hex) {
    swatches.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.hex === hex.toLowerCase())));
    custom.value = hex;
    await saved({ accent: hex });
    await applyAccent(settings);
  }

  const protection = h('p', { class: 'muted', id: 'protection' }, 'Checking…');
  const protectButton = h('button', { class: 'btn block', type: 'button', onclick: async () => {
    const ok = await requestPersistence();
    toast(ok ? 'Your data is now protected from automatic clean-up.' : 'This browser did not agree. Back up important visits to be safe.', 6000);
    showProtection();
  } }, 'Ask the browser to protect my data');
  async function showProtection() {
    const on = await navigator.storage?.persisted?.().catch(() => false);
    const known = typeof navigator.storage?.persisted === 'function';
    protection.textContent = !known ? 'Your browser cannot report this.' : on ? 'Protection is on: the browser will not clear your visits to free space.' : 'Protection is off: the browser may clear your visits if the device runs low on space or you do not use the app for a long time.';
    protectButton.hidden = !known || on;
  }

  screen.append(
    h('div', { class: 'topbar' }, h('a', { class: 'btn', href: '#/more' }, '← Back'), h('h1', {}, 'Settings')),
    h('div', { class: 'stack' },
      status,
      h('div', { class: 'card stack' }, h('h2', {}, 'About you'),
        text('Your name', 'preparedBy', { placeholder: 'Used as "Prepared by"', autocomplete: 'name' }),
        text('Your job title', 'designation', { placeholder: 'For example: Site Engineer' }),
        text('Company name', 'company', { placeholder: 'Shown at the bottom of each page', autocomplete: 'organization' })),
      picture({ key: 'logo', title: 'Company logo', help: 'Shown on the front page of your reports. Skip it if you do not have one.', maxSide: 600, signature: false }),
      picture({ key: 'signature', title: 'Signature', help: 'Sign your name on white paper, take a photo, and choose it here. The paper colour is removed for you.', maxSide: 500, signature: true }),
      h('div', { class: 'card stack' }, h('h2', {}, 'Report colour'),
        h('div', { class: 'swatches', role: 'group', 'aria-label': 'Report colour' }, swatches, custom),
        h('p', { class: 'muted small' }, 'Used for the page numbers on photos, the front page bar, and the buttons in this app.')),
      h('div', { class: 'card stack' }, h('h2', {}, 'Photos on each page'), choice('Photos on each page', LAYOUTS, 'perPage', settings.perPage),
        h('p', { class: 'muted small' }, 'You can change this again each time you make a PDF.')),
      h('div', { class: 'card stack' }, h('h2', {}, 'Paper size'), choice('Paper size', PAPERS, 'paper', settings.paper)),
      h('div', { class: 'card stack' }, h('h2', {}, 'Light or dark'),
        h('p', {}, 'SiteSnap follows your phone or computer. Turn dark mode on or off in your device settings and this app changes with it.')),
      h('div', { class: 'card stack' }, h('h2', {}, 'Your data'),
        h('p', {}, h('strong', {}, 'No account. No server. No tracking. '), 'Your photos and reports stay on this device.'),
        h('p', {}, 'If you do not use SiteSnap for a long time, your browser may clear its saved data. Use "Back up this visit" on important visits.'),
        protection, protectButton)));
  showProtection();
  return () => { urls.release(); clearTimeout(statusTimer); };
}
