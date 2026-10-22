import { h, toast, sheet, confirmDialog, formatDate, plural, urlTracker, icon } from '../ui.js';
import { listVisits, countEntries, firstEntry, deleteVisit, duplicateVisit } from '../db.js';
import { installMode, promptInstall, dismissInstall, onInstallChange } from '../install.js';

function installBanner() {
  const box = h('div');
  const update = () => {
    const mode = installMode();
    box.replaceChildren();
    if (!mode) return;
    const text = {
      prompt: 'Install SiteSnap on this device to open it like any other app, even with no signal.',
      ios: 'To install: tap the Share button (the square with an arrow), then tap "Add to Home Screen".',
      mac: 'To install: in Safari, choose File, then "Add to Dock".',
    }[mode];
    box.append(h('div', { class: 'banner', role: 'region', 'aria-label': 'Install SiteSnap' },
      h('div', {}, h('strong', {}, 'Install SiteSnap'), h('p', { class: 'small', style: 'margin:.25rem 0 0' }, text)),
      h('div', { class: 'buttons' },
        mode === 'prompt' && h('button', { class: 'btn primary', onclick: promptInstall }, 'Install'),
        h('button', { class: 'btn ghost', onclick: dismissInstall, 'aria-label': 'Not now, hide the install message' }, 'Not now'))));
  };
  update();
  return { node: box, stop: onInstallChange(update) };
}

export async function home(screen, _params, { go }) {
  const urls = urlTracker();
  const visits = await listVisits();
  const summaries = await Promise.all(visits.map(async (v) => ({
    visit: v,
    count: await countEntries(v.id),
    first: await firstEntry(v.id),
  })));

  const banner = installBanner();
  const list = h('div', { class: 'stack' });
  const search = h('input', { type: 'search', id: 'search', placeholder: 'Project, place or name', autocomplete: 'off' });

  function drawList() {
    const query = search.value.trim().toLowerCase();
    const shown = summaries.filter(({ visit }) =>
      !query || [visit.project, visit.location, visit.preparedBy].some((s) => (s ?? '').toLowerCase().includes(query)));
    list.replaceChildren();
    list.toggleAttribute('role', false);
    if (!shown.length) {
      list.append(h('p', { class: 'muted' }, summaries.length ? 'No visits match your search.' : 'No visits yet. Tap "Start new site visit" to begin.'));
      return;
    }
    list.setAttribute('role', 'list');                    // only a real list of items gets the list role
    for (const { visit, count, first } of shown) {
      const thumb = first?.thumb
        ? h('img', { class: 'thumb', src: urls.url(first.thumb), alt: '' })
        : h('div', { class: 'thumb', 'aria-hidden': 'true' }, icon('camera', 24));
      list.append(h('div', { class: 'card visit', role: 'listitem' },
        h('button', { class: 'open', onclick: () => go(`#/visit/${visit.id}`) },
          thumb,
          h('span', { class: 'grow' },
            h('span', { class: 'title' }, visit.project), h('br'),
            h('span', { class: 'muted small' }, [visit.location, formatDate(visit.date)].filter(Boolean).join(' · ')), h('br'),
            h('span', { class: 'muted small' }, plural(count, 'photo')))),
        h('button', { class: 'btn menu', 'aria-label': `Options for ${visit.project}`, onclick: () => options(visit) }, icon('dots', 24))));
    }
  }

  async function options(visit) {
    const choice = await sheet({
      title: visit.project,
      actions: [
        { id: 'open', label: 'Open', primary: true },
        { id: 'copy', label: 'Duplicate' },
        { id: 'delete', label: 'Delete', danger: true },
      ],
    });
    if (choice === 'open') go(`#/visit/${visit.id}`);
    if (choice === 'copy') {
      const how = await sheet({
        title: 'Duplicate this visit',
        message: 'A copy is useful for a return visit to the same site.',
        actions: [
          { id: 'details', label: 'Copy the details only', primary: true },
          { id: 'all', label: 'Copy everything, with photos' },
        ],
      });
      if (!how) return;
      const copy = await duplicateVisit(visit.id, how === 'all');
      toast('Visit duplicated');
      go(`#/visit/${copy.id}`);
    }
    if (choice === 'delete') {
      const yes = await confirmDialog({
        title: 'Delete this visit?',
        message: `"${visit.project}" and all its photos will be removed from this device. This cannot be undone.`,
        confirmText: 'Delete it', cancelText: 'Keep it', danger: true,
      });
      if (!yes) return;
      await deleteVisit(visit.id);
      toast('Visit deleted');
      window.dispatchEvent(new HashChangeEvent('hashchange'));   // redraw this screen
    }
  }

  screen.append(
    h('div', { class: 'topbar home' }, h('img', { class: 'logo', src: 'icons/icon-192.png', alt: '', width: 36, height: 36 }), h('h1', {}, 'SiteSnap'), h('a', { class: 'btn ghost', href: '#/more' }, 'More')),
    h('div', { class: 'stack' },
      banner.node,
      h('a', { class: 'btn primary big', href: '#/new' }, icon('plus', 24), 'Start new site visit'),
      summaries.length > 0 && h('label', { class: 'field' }, h('span', { class: 'sr-only' }, 'Search past visits'), search),
      summaries.length > 0 && h('h2', { class: 'section' }, 'Past visits'),
      list),
    h('p', { class: 'privacy' }, 'Everything stays on this device. No account, no tracking.'),
    h('p', { class: 'privacy' }, 'If you do not use the app for a long time, your browser may clear saved visits. Back up important ones from the visit screen (More).'));

  search.addEventListener('input', drawList);
  drawList();
  return () => { urls.release(); banner.stop(); };
}
