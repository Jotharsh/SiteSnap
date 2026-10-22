// Builds a report: gathers the data, lays it out, and writes the PDF. Everything happens on this device.
import { loadFonts, registerWithPdf, registerWithPage } from './fonts.js';
import { sanitize } from './text.js';
import { layoutReport } from './layout.js';
import { renderPdf } from './render-pdf.js';
import { prepareImages } from './render-canvas.js';
import { formatDate, formatTime } from '../ui.js';
import { nextReportNumber, patchVisit } from '../db.js';

let jsPdfLoading;
/** jsPDF is a classic script, loaded only when the first report is made (and kept by the offline cache). */
function loadJsPdf() {
  jsPdfLoading ??= new Promise((resolve, reject) => {
    if (window.jspdf?.jsPDF) { resolve(window.jspdf.jsPDF); return; }
    const script = document.createElement('script');
    script.src = new URL('../../vendor/jspdf.umd.min.js', import.meta.url);
    script.onload = () => resolve(window.jspdf.jsPDF);
    script.onerror = () => { jsPdfLoading = undefined; reject(new Error('The PDF tool could not be loaded.')); };
    document.head.append(script);
  });
  return jsPdfLoading;
}

let assetCounter = 0;
/** A picture as the report needs it: its bytes, type and size. */
export async function toAsset(blob, knownSize) {
  if (!blob) return null;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const mime = blob.type === 'image/png' ? 'image/png' : 'image/jpeg';
  let { width, height } = knownSize ?? {};
  if (!width || !height) {
    const bitmap = await createImageBitmap(blob);
    ({ width, height } = bitmap);
    bitmap.close?.();
  }
  return { id: `img${++assetCounter}`, bytes, mime, format: mime === 'image/png' ? 'PNG' : 'JPEG', width, height };
}

const slug = (s) => s.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'Report';

/**
 * @param {{visit, entries, settings, remarks?: string, perPage?: number}} args
 * @param {{reportNo?: string, onProgress?: (text: string) => void}} options  pass reportNo to skip allocating a new number (tests)
 * @returns {{blob: Blob, layout, pageCount: number, reportNo: string, fileName: string, fonts}}
 */
export async function buildReport({ visit, entries, settings, remarks = '', perPage }, { reportNo, onProgress } = {}) {
  onProgress?.('Preparing…');
  const [JsPdf, fonts] = await Promise.all([loadJsPdf(), loadFonts()]);
  const doc = new JsPdf({ unit: 'mm', format: settings.paper === 'letter' ? 'letter' : 'a4', orientation: 'portrait', compress: true });
  registerWithPdf(doc, fonts);

  const cache = new Map();
  const measure = (text, size, bold) => {
    const key = `${bold ? 'b' : 'n'}${size}|${text}`;
    let width = cache.get(key);
    if (width === undefined) {
      doc.setFont('Inter', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      width = doc.getTextWidth(text);
      cache.set(key, width);
    }
    return width;
  };

  if (!reportNo) {
    reportNo = visit.reportNo ?? await nextReportNumber();
    if (visit.reportNo !== reportNo) await patchVisit(visit.id, { reportNo });    // the same visit keeps its number when the PDF is made again
  }

  onProgress?.('Preparing photos…');
  const clean = (text) => sanitize(text, fonts.covered);
  const logo = await toAsset(settings.logo);
  const signature = await toAsset(settings.signature);
  const items = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    items.push({
      number: i + 1, comment: clean(e.comment), tag: e.tag, timeText: formatTime(e.createdAt),
      asset: await toAsset(e.photo, { width: e.width, height: e.height }),
    });
  }

  onProgress?.('Laying out pages…');
  const layout = layoutReport({
    paper: settings.paper, perPage: perPage ?? settings.perPage, accent: settings.accent,
    company: clean(settings.company), logo, signature,
    project: clean(visit.project), location: clean(visit.location), dateText: formatDate(visit.date),
    preparedBy: clean(visit.preparedBy), designation: clean(settings.designation), reportNo,
    remarks: clean(remarks), entries: items, todayText: formatDate(new Date()),
  }, measure);

  onProgress?.('Writing the PDF…');
  const blob = renderPdf(doc, layout, { title: `Site Inspection Report ${reportNo}`, subject: clean(visit.project), author: clean(visit.preparedBy) });
  return { blob, layout, pageCount: layout.pages.length, reportNo, fileName: `Site-Report_${reportNo}_${slug(clean(visit.project))}.pdf`, fonts, measure };
}

export { prepareImages, registerWithPage };
