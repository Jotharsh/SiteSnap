// Decides where everything goes on every page of the report. It produces plain drawing instructions ("ops") in millimetres,
// which one renderer turns into the PDF and another paints on screen for the preview, so the two can never disagree.
import { fit, wrap } from './text.js';

export const SIZE = { title: 22, body: 11, small: 8.5 };          // the only three type sizes in the report (points)
export const PAPERS = { a4: { w: 210, h: 297 }, letter: { w: 215.9, h: 279.4 } };
export const TAG_STYLES = {
  urgent: { label: 'Urgent', fill: [211, 47, 47], ink: [255, 255, 255] },
  fix: { label: 'Needs Fix', fill: [245, 158, 11], ink: [17, 17, 17] },
  done: { label: 'Done', fill: [46, 125, 50], ink: [255, 255, 255] },
  note: { label: 'Note', fill: [97, 97, 97], ink: [255, 255, 255] },
};

const PT = 25.4 / 72;
const mm = (pt) => pt * PT;
export const lineHeight = (pt) => mm(pt) * 1.38;
const baselineOf = (top, pt) => top + mm(pt) * 1.06;                // where the letters sit inside a line that starts at `top`

const INK = [17, 17, 17], GREY = [107, 114, 128], LIGHT = [243, 244, 246], BORDER = [200, 204, 212], WHITE = [255, 255, 255];
const hexToRgb = (hex) => (/^#[0-9a-f]{6}$/i.test(hex) ? [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) : [194, 65, 12]);

function fitBox(asset, boxW, boxH) {
  const scale = Math.min(boxW / asset.width, boxH / asset.height);
  return { w: asset.width * scale, h: asset.height * scale };
}

/**
 * @param input  everything the report shows, already prepared (see report.js)
 * @param measure (text, sizePt, bold) => width in mm, using the real embedded font
 */
export function layoutReport(input, measure) {
  const paper = PAPERS[input.paper] ?? PAPERS.a4;
  const accent = hexToRgb(input.accent);
  const accentInk = (0.2126 * accent[0] + 0.7152 * accent[1] + 0.0722 * accent[2]) / 255 > 0.6 ? INK : WHITE;   // dark numbers on a light accent, white on a dark one
  const G = { W: paper.w, H: paper.h, L: 18, R: 18, top: 22, bottom: paper.h - 20 };   // margins of 18 mm at the sides, content between the header and footer
  G.cw = G.W - G.L - G.R;
  const pages = [];
  const BODY = SIZE.body, SMALL = SIZE.small, TITLE = SIZE.title;
  const lhBody = lineHeight(BODY);

  const newPage = (kind) => { const page = { kind, ops: [] }; pages.push(page); return page; };
  const text = (page, str, x, top, pt, { bold = false, color = INK, align = 'left', ref } = {}) =>
    page.ops.push({ t: 'text', str, x, y: baselineOf(top, pt), size: pt, bold, color, align, ref });
  const textAt = (page, str, x, baseline, pt, o = {}) =>
    page.ops.push({ t: 'text', str, x, y: baseline, size: pt, bold: o.bold ?? false, color: o.color ?? INK, align: o.align ?? 'left', ref: o.ref });
  const rect = (page, x, y, w, h, o = {}) => page.ops.push({ t: 'rect', x, y, w, h, ...o });
  const line = (page, x1, y1, x2, y2, color = BORDER, lw = 0.25) => page.ops.push({ t: 'line', x1, y1, x2, y2, color, lw });
  const width = (str, pt, bold = false) => measure(str, pt, bold);
  const wrapAt = (str, maxW, pt, bold = false) => wrap((s) => width(s, pt, bold), str, maxW);

  // ---------- 1. cover ----------
  (function cover() {
    const page = newPage('cover');
    const x = G.L;
    rect(page, x, 22, 28, 2.2, { fill: accent });
    let y = 36;
    if (input.logo) {
      const s = fitBox(input.logo, 70, 30);
      page.ops.push({ t: 'image', x, y, w: s.w, h: s.h, asset: input.logo });
      y += 34;
    } else if (input.company) {
      text(page, input.company, x, y, BODY, { bold: true });
      y += lhBody + 4;
    }
    y = Math.max(y + 24, 104);
    text(page, 'Site Inspection Report', x, y, TITLE, { bold: true });
    y += lineHeight(TITLE) + 3;
    for (const l of wrapAt(input.project, G.cw, TITLE)) { text(page, l, x, y, TITLE, { color: GREY }); y += lineHeight(TITLE); }
    y += 8;
    line(page, x, y, x + G.cw, y, BORDER, 0.35);
    y += 9;
    const rows = [['Location', input.location], ['Date', input.dateText], ['Prepared by', input.preparedBy], ['Report number', input.reportNo]];
    for (const [label, value] of rows) {
      if (!value) continue;
      text(page, label.toUpperCase(), x, y, SMALL, { color: GREY });
      y += lineHeight(SMALL) + 0.5;
      for (const l of wrapAt(value, G.cw, BODY)) { text(page, l, x, y, BODY); y += lhBody; }
      y += 6;
    }
  })();

  // ---------- 2. summary ----------
  (function summary() {
    let page = newPage('summary');
    const x = G.L, right = G.L + G.cw;
    let y = G.top;
    text(page, 'Summary', x, y, TITLE, { bold: true });
    y += lineHeight(TITLE) + 6;

    const counts = Object.fromEntries(Object.keys(TAG_STYLES).map((k) => [k, 0]));
    let untagged = 0;
    for (const e of input.entries) { if (counts[e.tag] !== undefined) counts[e.tag]++; else untagged++; }

    text(page, 'CATEGORY', x, y, SMALL, { color: GREY });
    text(page, 'COUNT', right, y, SMALL, { color: GREY, align: 'right' });
    y += lineHeight(SMALL) + 1.5;
    line(page, x, y, right, y, INK, 0.4);
    const rowH = 10.5;
    const row = (label, count, { bold = false, swatch = null } = {}) => {
      if (swatch) page.ops.push({ t: 'circle', x: x + 2.4, y: y + rowH / 2, r: 2, fill: swatch });
      text(page, label, x + (swatch ? 8 : 0), y + (rowH - lhBody) / 2, BODY, { bold });
      text(page, String(count), right, y + (rowH - lhBody) / 2, BODY, { bold, align: 'right' });
      y += rowH;
      line(page, x, y, right, y, BORDER, 0.25);
    };
    row('Total observations', input.entries.length, { bold: true });
    for (const [id, style] of Object.entries(TAG_STYLES)) row(style.label, counts[id], { swatch: style.fill });
    if (untagged) row('No label', untagged, { swatch: [200, 204, 212] });

    const remarks = input.remarks.trim();
    if (remarks) {
      y += 9;
      let first = true;
      let lines = wrapAt(remarks, G.cw, BODY);
      while (lines.length) {
        if (y + lineHeight(BODY) * 2 > G.bottom) { page = newPage('summary'); y = G.top; first = false; }
        text(page, first ? 'Overall remarks' : 'Overall remarks (continued)', x, y, BODY, { bold: true });
        y += lhBody + 1.5;
        let used = 0;
        while (used < lines.length && y + lhBody <= G.bottom) { text(page, lines[used], x, y, BODY); y += lhBody; used++; }
        lines = lines.slice(used);
        first = false;
        if (lines.length) { page = newPage('summary'); y = G.top; }
      }
    }
  })();

  // ---------- 3. observations ----------
  const photoFrame = (page, asset, x, y, w, h, number) => {
    rect(page, x, y, w, h, { fill: LIGHT });
    const s = fitBox(asset, w, h);
    page.ops.push({ t: 'image', x: x + (w - s.w) / 2, y: y + (h - s.h) / 2, w: s.w, h: s.h, asset, ref: number });
    rect(page, x, y, w, h, { stroke: BORDER, lw: 0.3 });
    const label = String(number);
    const bw = Math.max(8.4, width(label, SMALL, true) + 4.4), cx = x + 1.5 + bw / 2, cy = y + 1.5 + 4.2;
    rect(page, x + 1.5, y + 1.5, bw, 8.4, { fill: accent, radius: 4.2 });
    textAt(page, label, cx, cy + mm(SMALL) * 0.36, SMALL, { bold: true, color: accentInk, align: 'center' });
  };

  const CHIP_ROW = 7;
  /** The label chip and time, then returns the y below them. */
  const chipRow = (page, entry, x, y) => {
    let cursor = x;
    const style = TAG_STYLES[entry.tag];
    if (style) {
      const cw = width(style.label, SMALL, true) + 4.8;
      rect(page, x, y, cw, 4.8, { fill: style.fill, radius: 2.4 });
      textAt(page, style.label, x + cw / 2, y + 3.45, SMALL, { bold: true, color: style.ink, align: 'center' });
      cursor += cw + 3;
    }
    if (entry.timeText) textAt(page, entry.timeText, cursor, y + 3.45, SMALL, { color: GREY });
    return y + CHIP_ROW;
  };
  const commentLines = (entry, w) => (entry.comment.trim() ? wrapAt(entry.comment, w, BODY) : ['No comment.']);
  const drawLines = (page, entry, lines, x, y) => {
    const color = entry.comment.trim() ? INK : GREY;
    lines.forEach((l, i) => text(page, l, x, y + i * lhBody, BODY, { color, ref: entry.number }));
  };

  // A "cell" returns null if the comment will not fit in it, so the entry can be given a whole page instead.
  const cellRow = (entry, w, h) => {                              // 2 per page: photo on the left, text on the right
    const frameW = Math.min(96, w * 0.56), frameH = Math.min(104, h);
    const textX = frameW + 6, lines = commentLines(entry, w - textX);
    if (CHIP_ROW + lines.length * lhBody > h) return null;
    return (page, x, y) => {
      photoFrame(page, entry.asset, x, y, frameW, frameH, entry.number);
      const below = chipRow(page, entry, x + textX, y);
      drawLines(page, entry, lines, x + textX, below);
    };
  };
  const cellStack = (entry, w, h) => {                            // 4 per page: photo on top, text underneath
    const lines = commentLines(entry, w);
    for (const frameH of [66, 58, 50, 44]) {
      if (frameH + 3 + CHIP_ROW + lines.length * lhBody <= h) {
        return (page, x, y) => {
          photoFrame(page, entry.asset, x, y, w, frameH, entry.number);
          const below = chipRow(page, entry, x, y + frameH + 3);
          drawLines(page, entry, lines, x, below);
        };
      }
    }
    return null;
  };

  /** A whole page for one entry: used for 1 per page, and for comments too long for a smaller cell. A very long comment continues on further pages. */
  const fullPage = (entry) => {
    const page = newPage('obs');
    const x = G.L, avail = G.bottom - G.top;
    const lines = commentLines(entry, G.cw);
    let frameH = 70;
    for (const candidate of [130, 110, 90, 70]) { frameH = candidate; if (candidate + 4 + CHIP_ROW + lines.length * lhBody <= avail) break; }
    photoFrame(page, entry.asset, x, G.top, G.cw, frameH, entry.number);
    let y = chipRow(page, entry, x, G.top + frameH + 4);
    let used = 0;
    const color = entry.comment.trim() ? INK : GREY;
    while (used < lines.length && y + lhBody <= G.bottom) { text(page, lines[used], x, y, BODY, { color, ref: entry.number }); y += lhBody; used++; }
    while (used < lines.length) {
      const more = newPage('obs');
      text(more, `Observation ${entry.number} (continued)`, x, G.top, BODY, { bold: true });
      let yy = G.top + lhBody + 2;
      while (used < lines.length && yy + lhBody <= G.bottom) { text(more, lines[used], x, yy, BODY, { color, ref: entry.number }); yy += lhBody; used++; }
    }
  };

  (function observations() {
    const per = [1, 2, 4].includes(input.perPage) ? input.perPage : 2;
    const gap = 6;
    const cols = per === 4 ? 2 : 1, rows = per === 1 ? 1 : 2;
    const cellW = (G.cw - gap * (cols - 1)) / cols;
    const cellH = (G.bottom - G.top - gap * (rows - 1)) / rows;
    let page = null, slot = 0;
    for (const entry of input.entries) {
      const draw = per === 1 ? null : (per === 2 ? cellRow : cellStack)(entry, cellW, cellH);
      if (per === 1 || !draw) { fullPage(entry); page = null; continue; }
      if (!page || slot >= per) { page = newPage('obs'); slot = 0; }
      const x = G.L + (slot % cols) * (cellW + gap), y = G.top + Math.floor(slot / cols) * (cellH + gap);
      draw(page, x, y);
      if (per === 2 && slot === 0) line(page, G.L, y + cellH + gap / 2, G.L + G.cw, y + cellH + gap / 2, BORDER, 0.2);
      slot++;
    }
  })();

  // ---------- 4. sign-off ----------
  (function signOff() {
    const page = newPage('signoff');
    const x = G.L;
    let y = G.top;
    text(page, 'Sign-off', x, y, TITLE, { bold: true });
    y += lineHeight(TITLE) + 8;
    const blocks = [
      ['Prepared by', { name: input.preparedBy, designation: input.designation, date: input.todayText, signature: input.signature }],
      ['Reviewed by', {}],
    ];
    for (const [title, v] of blocks) {
      const h = 84;
      rect(page, x, y, G.cw, h, { stroke: BORDER, lw: 0.3 });
      text(page, title, x + 8, y + 5, BODY, { bold: true });
      const field = (label, value, top, fullWidth = true) => {
        text(page, label.toUpperCase(), x + 8, top, SMALL, { color: GREY });
        const lineY = top + 9.5, end = fullWidth ? x + G.cw - 8 : x + 8 + 70;
        if (value) text(page, fit((s) => width(s, BODY), value, end - x - 8), x + 8, lineY - lhBody - 0.3, BODY);
        line(page, x + 8, lineY, end, lineY, INK, 0.3);
      };
      field('Name', v.name, y + 14);
      field('Designation', v.designation, y + 28);
      field('Date', v.date, y + 42, false);
      text(page, 'SIGNATURE', x + 8, y + 56, SMALL, { color: GREY });
      if (v.signature) {
        const s = fitBox(v.signature, 56, 14);
        page.ops.push({ t: 'image', x: x + 8, y: y + 76 - s.h - 0.5, w: s.w, h: s.h, asset: v.signature });
      }
      line(page, x + 8, y + 76, x + G.cw - 8, y + 76, INK, 0.3);
      y += h + 8;
    }
  })();

  // ---------- header and footer on every page after the cover ----------
  const total = pages.length;
  pages.forEach((page, index) => {
    if (index === 0) return;
    const left = G.L, right = G.L + G.cw;
    textAt(page, fit((s) => width(s, SMALL), input.project, G.cw * 0.68), left, 11.2, SMALL, { color: GREY });
    textAt(page, input.reportNo, right, 11.2, SMALL, { color: GREY, align: 'right' });
    line(page, left, 14.5, right, 14.5, BORDER, 0.25);
    line(page, left, G.H - 15.5, right, G.H - 15.5, BORDER, 0.25);
    if (input.company) textAt(page, fit((s) => width(s, SMALL), input.company, G.cw * 0.6), left, G.H - 10.5, SMALL, { color: GREY });
    textAt(page, `Page ${index + 1} of ${total}`, right, G.H - 10.5, SMALL, { color: GREY, align: 'right' });
  });

  return { pages, paper: { w: G.W, h: G.H }, geometry: G };
}
