import { h, toast, plural, backLabel, icon } from '../ui.js';
import { getVisit, listEntries, getSettings, patchVisit } from '../db.js';

const LAYOUTS = [[1, 'One per page'], [2, 'Two per page'], [4, 'Four per page']];

/** "Make PDF": a few optional choices, then a full preview of every page, then Share or Download. */
export async function pdfScreen(screen, [id], { go }) {
  const visit = await getVisit(id);
  if (!visit) { screen.append(h('h1', {}, 'Visit not found'), h('a', { class: 'btn primary', href: '#/' }, 'Go to home')); return; }
  const entries = await listEntries(id);
  const settings = await getSettings();
  let perPage = settings.perPage;
  let objectUrl = null;
  let observer = null;
  let disposed = false;

  const back = (href, label = 'Back') => h('a', { class: 'btn ghost back', href }, backLabel(label));

  if (!entries.length) {
    screen.append(
      h('div', { class: 'topbar' }, back(`#/visit/${id}`), h('h1', {}, 'Make PDF')),
      h('div', { class: 'stack' },
        h('p', {}, 'There are no photos in this visit yet, so there is nothing to put in a report.'),
        h('a', { class: 'btn primary big', href: `#/visit/${id}` }, 'Go back and add a photo')));
    return;
  }

  // ---------- choices ----------
  function showOptions() {
    teardownPreview();
    const remarks = h('textarea', {
      id: 'remarks', value: visit.remarks ?? '', rows: 5, placeholder: 'For example: Work is on schedule. Urgent items need action before the next pour.',
      oninput: () => { visit.remarks = remarks.value; clearTimeout(saveTimer); saveTimer = setTimeout(saveRemarks, 400); },
      onblur: () => saveRemarks(),
    });
    let saveTimer;
    const saveRemarks = () => { clearTimeout(saveTimer); return patchVisit(id, { remarks: visit.remarks ?? '' }); };   // only the remarks: never overwrite the rest of the visit
    const layoutButtons = LAYOUTS.map(([n, label]) => h('button', {
      class: 'tagbtn', type: 'button', 'aria-pressed': String(n === perPage), dataset: { per: n },
      onclick: () => { perPage = n; layoutButtons.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.per) === perPage))); },
    }, label));
    const message = h('p', { class: 'error', role: 'alert', hidden: true });

    screen.replaceChildren(
      h('div', { class: 'topbar' }, back(`#/visit/${id}`), h('h1', {}, 'Make PDF')),
      h('div', { class: 'stack' },
        h('p', {}, `Your report will include ${plural(entries.length, 'photo')} from "${visit.project}".`),
        h('label', { class: 'field', for: 'remarks' }, h('span', {}, 'Overall remarks (optional)'), remarks, h('small', {}, 'Shown on the summary page.')),
        h('div', { class: 'field' }, h('span', {}, 'Photos on each page'), h('div', { class: 'tags three', role: 'group', 'aria-label': 'Photos on each page' }, layoutButtons)),
        message,
        h('button', { class: 'btn primary big', onclick: () => make(message) }, 'Make PDF')));
  }

  // ---------- making it ----------
  async function make(message) {
    const progress = h('p', { class: 'muted', role: 'status' }, 'Getting ready…');
    screen.replaceChildren(
      h('div', { class: 'topbar' }, h('h1', {}, 'Making your PDF…')),
      h('div', { class: 'stack' }, progress, h('p', { class: 'muted small' }, 'This takes a few seconds. Please keep this screen open.')));
    try {
      const { buildReport, prepareImages, registerWithPage } = await import('../pdf/report.js');
      await patchVisit(id, { remarks: visit.remarks ?? '' });
      const fresh = await getVisit(id);
      const result = await buildReport(
        { visit: fresh, entries, settings, remarks: fresh.remarks ?? '', perPage },
        { onProgress: (text) => { progress.textContent = text; } });
      progress.textContent = 'Preparing the preview…';
      await registerWithPage(result.fonts);
      await prepareImages(result.layout);
      if (disposed) return;
      showPreview(result);
    } catch (error) {
      console.error(error);
      showOptions();
      const note = screen.querySelector('.error');
      if (note) { note.hidden = false; note.textContent = 'The PDF could not be made. Your visit is safe. Please try again.'; }
    }
  }

  // ---------- preview, share, download ----------
  async function showPreview({ blob, layout, pageCount, fileName, reportNo }) {
    const { paintPage } = await import('../pdf/render-canvas.js');
    objectUrl = URL.createObjectURL(blob);
    const file = new File([blob], fileName, { type: 'application/pdf' });
    const canShare = Boolean(navigator.canShare?.({ files: [file] }) && navigator.share);

    const share = async () => {
      try {
        await navigator.share({ files: [file], title: `Site Inspection Report ${reportNo}`, text: `${visit.project} (${reportNo})` });
      } catch (error) {
        if (error?.name !== 'AbortError') { console.error(error); toast('Sharing did not work. Tap Download instead.', 5000); }
      }
    };
    const download = () => {
      const link = h('a', { href: objectUrl, download: fileName });
      document.body.append(link);
      link.click();
      link.remove();
      toast('PDF saved. Look in your Downloads or Files.', 5000);
    };

    const pages = layout.pages.map((page, index) => {
      const canvas = h('canvas', { width: 1, height: 1, role: 'img', 'aria-label': `Page ${index + 1} of ${pageCount}` });   // 1x1 until painted (a default canvas is 300x150)
      const box = h('div', { class: 'pagebox', style: `--ar:${layout.paper.w} / ${layout.paper.h}` }, canvas);
      return { page, canvas, box, painted: false, index };
    });

    const paint = (p) => {
      const cssWidth = p.box.clientWidth || 360;
      const pixels = Math.min(1100, cssWidth * Math.min(window.devicePixelRatio || 1, 2));
      paintPage(p.canvas, p.page, layout.paper, pixels / layout.paper.w);
      p.painted = true;
    };
    const release = (p) => { p.canvas.width = 1; p.canvas.height = 1; p.painted = false; };   // hand the memory back: pages far from the screen are repainted when they return
    observer = new IntersectionObserver((records) => {
      for (const record of records) {
        const p = pages.find((x) => x.box === record.target);
        if (record.isIntersecting && !p.painted) paint(p);
        else if (!record.isIntersecting && p.painted) release(p);
      }
    }, { rootMargin: '150% 0px' });

    const sizeText = blob.size > 1e6 ? `${(blob.size / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(blob.size / 1000))} KB`;
    screen.replaceChildren(
      h('div', { class: 'topbar' }, back(`#/visit/${id}`, 'Visit'), h('h1', {}, 'Your report')),
      h('div', { class: 'stack' },
        h('p', { id: 'ready' }, h('strong', {}, 'Ready. '), `${plural(pageCount, 'page')}, ${sizeText}. Scroll to check every page.`),
        h('button', { class: 'btn block', onclick: showOptions }, 'Change options and make it again'),
        h('div', { class: 'pages' }, pages.map((p) => p.box))),
      h('div', { class: 'bottombar two' },
        canShare && h('button', { class: 'btn primary big', id: 'share', onclick: share }, icon('share', 22), 'Share'),
        h('button', { class: `btn big ${canShare ? '' : 'primary'}`, id: 'download', onclick: download }, icon('download', 22), 'Download')));
    pages.forEach((p) => observer.observe(p.box));
    window.addEventListener('resize', repaint);
    function repaint() { pages.filter((p) => p.painted).forEach(paint); }
    previewCleanup = () => { observer?.disconnect(); window.removeEventListener('resize', repaint); pages.forEach(release); };
  }

  let previewCleanup = null;
  function teardownPreview() {
    previewCleanup?.(); previewCleanup = null;
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
  }

  showOptions();
  return () => { disposed = true; teardownPreview(); };
}
