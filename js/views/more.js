import { h, toast } from '../ui.js';
import { importVisit, BackupError } from '../backup.js';
import { APP_VERSION } from '../config.js';

const bar = (title, back = '#/') =>
  h('div', { class: 'topbar' }, h('a', { class: 'btn', href: back }, '← Back'), h('h1', {}, title));

export function more(screen, _params, { go }) {
  const input = h('input', {
    type: 'file', id: 'import', accept: '.json,.sitesnap,application/json', class: 'sr-only',
    onchange: async () => {
      const file = input.files[0];
      input.value = '';
      if (!file) return;
      try {
        const { visit, count } = await importVisit(file);
        toast(`Opened "${visit.project}" with ${count} photo${count === 1 ? '' : 's'}.`, 5000);
        go(`#/visit/${visit.id}`);
      } catch (error) {
        if (!(error instanceof BackupError)) console.error(error);
        toast(error instanceof BackupError ? error.message : 'That file could not be opened.', 6000);
      }
    },
  });
  screen.append(
    bar('More'),
    h('div', { class: 'stack' },
      h('a', { class: 'btn block', href: '#/settings' }, 'Settings (name, logo, colour, paper)'),
      h('label', { class: 'btn block' }, 'Open a backup file', input),
      h('a', { class: 'btn block', href: '#/help' }, 'How to use SiteSnap'),
      h('a', { class: 'btn block', href: '#/privacy' }, 'Privacy and storage'),
      h('p', { class: 'muted small' }, 'Saved visits live in this browser. If you do not use the app for a long time, the browser may clear them, so back up important visits.'),
      h('p', { class: 'muted small' }, `SiteSnap version ${APP_VERSION}`)));
}

const step = (title, text) => h('li', {}, h('strong', {}, title), ' ', text);

export function help(screen) {
  screen.append(
    bar('How to use SiteSnap', '#/more'),
    h('div', { class: 'stack' },
      h('h2', {}, 'Make a report in 5 steps'),
      h('ol', { class: 'stack' },
        step('Start.', 'On the home screen tap "Start new site visit". Type the project name. That is the only thing you must fill in.'),
        step('Take photos.', 'Tap "Take photo". The camera opens. After each photo, type a short comment. You can also tap a label: Urgent, Needs Fix, Done or Note.'),
        step('Check your list.', 'All your photos appear in a list. Tap one to change it or delete it. Tap "Change order" to move photos up or down.'),
        step('Make the PDF.', 'Tap "Make PDF". You can add overall remarks first. You will see every page before you share.'),
        step('Share.', 'Tap "Share" to send it by email or messages. If Share is missing on your device, tap "Download".')),
      h('h2', {}, 'Good to know'),
      h('ul', { class: 'stack' },
        h('li', {}, 'It works with no signal. Everything is saved on your device as you go.'),
        h('li', {}, 'Use "Back up" on a visit now and then, so you have a copy outside the app.'),
        h('li', {}, 'Your name, company logo and signature are set once under More, then Settings.'))));
}

export function privacy(screen) {
  screen.append(
    bar('Privacy and storage', '#/more'),
    h('div', { class: 'stack' },
      h('h2', {}, 'No account. No server. No tracking.'),
      h('p', {}, 'Your photos, comments and reports never leave your device unless you choose to share a PDF or a backup file. SiteSnap has no accounts, no analytics and no adverts.'),
      h('h2', {}, 'Where your data is kept'),
      h('p', {}, 'Visits are saved inside this app on your device. If you do not open SiteSnap for a long time, or you clear your browser data, your phone or browser may delete them.'),
      h('p', {}, h('strong', {}, 'To be safe: '), 'open a visit and use "Back up" to save a copy to your files, and share finished PDFs.'),
      h('p', {}, 'Installing SiteSnap to your home screen makes this safer on iPhone and Android.')));
}
