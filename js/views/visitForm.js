import { h, todayISO } from '../ui.js';
import { getSettings, getVisit, saveVisit, setSettings, newId } from '../db.js';

const field = (label, control, hint) => h('label', { class: 'field' }, h('span', {}, label), control, hint && h('small', {}, hint));

async function form(screen, { visit, go }) {
  const editing = Boolean(visit);
  const settings = await getSettings();

  const project = h('input', { type: 'text', id: 'project', value: visit?.project ?? '', autocomplete: 'off', autocapitalize: 'words', placeholder: 'For example: Riverside Apartments Block B', 'aria-required': 'true' });
  const location = h('input', { type: 'text', id: 'location', value: visit?.location ?? '', autocomplete: 'off', autocapitalize: 'words', placeholder: 'Street, area or floor' });
  const date = h('input', { type: 'date', id: 'date', value: visit?.date ?? todayISO() });
  const preparedBy = h('input', { type: 'text', id: 'prepared', value: visit?.preparedBy ?? settings.preparedBy, autocomplete: 'name', autocapitalize: 'words', placeholder: 'Your name' });
  const error = h('p', { class: 'error', id: 'project-error', role: 'alert', hidden: true }, 'Please type the project name.');

  async function submit(event) {
    event.preventDefault();
    if (!project.value.trim()) {
      error.hidden = false;
      project.setAttribute('aria-invalid', 'true');
      project.setAttribute('aria-describedby', 'project-error');
      project.focus();
      return;
    }
    const record = await saveVisit({
      ...(visit ?? { id: newId() }),
      project: project.value.trim(),
      location: location.value.trim(),
      date: date.value || todayISO(),
      preparedBy: preparedBy.value.trim(),
    });
    await setSettings({ preparedBy: record.preparedBy });      // remembered for the next visit
    go(`#/visit/${record.id}`);
  }

  screen.append(
    h('div', { class: 'topbar' },
      h('a', { class: 'btn', href: editing ? `#/visit/${visit.id}` : '#/' }, '← Back'),
      h('h1', {}, editing ? 'Visit details' : 'New site visit')),
    h('form', { class: 'stack', onsubmit: submit, novalidate: true },
      h('div', {}, field(h('span', {}, 'Project name ', h('span', { class: 'req', 'aria-hidden': 'true' }, '(required)')), project), error),
      field('Site or location', location),
      field('Date', date),
      field('Prepared by', preparedBy, 'Remembered for next time.'),
      h('button', { class: 'btn primary big', type: 'submit' }, editing ? 'Save details' : 'Start visit')));
  if (!editing) project.focus();
}

export const newVisit = (screen, _p, app) => form(screen, { go: app.go });

export async function editVisit(screen, [id], app) {
  const visit = await getVisit(id);
  if (!visit) { screen.append(h('h1', {}, 'Visit not found'), h('a', { class: 'btn primary', href: '#/' }, 'Go to home')); return; }
  return form(screen, { visit, go: app.go });
}
