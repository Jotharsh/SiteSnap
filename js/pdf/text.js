// Text helpers for the report: what the font can draw, and how to wrap text so nothing is ever cut off.

/** Which characters a TrueType font can draw, read from its "cmap" table (formats 4 and 12 cover everything we need). */
export function parseCmap(buffer) {
  const view = new DataView(buffer);
  const tables = view.getUint16(4);
  let cmapOffset = -1;
  for (let i = 0; i < tables; i++) {
    const at = 12 + 16 * i;
    if (String.fromCharCode(view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2), view.getUint8(at + 3)) === 'cmap') cmapOffset = view.getUint32(at + 8);
  }
  if (cmapOffset < 0) return null;
  const count = view.getUint16(cmapOffset + 2);
  let best = null;
  for (let i = 0; i < count; i++) {
    const at = cmapOffset + 4 + 8 * i;
    const platform = view.getUint16(at), encoding = view.getUint16(at + 2), offset = cmapOffset + view.getUint32(at + 4);
    const format = view.getUint16(offset);
    const rank = format === 12 ? 3 : (platform === 3 && encoding === 1 && format === 4) ? 2 : (format === 4 ? 1 : 0);
    if (rank && (!best || rank > best.rank)) best = { rank, offset, format };
  }
  if (!best) return null;

  const covered = new Set();
  const { offset } = best;
  if (best.format === 12) {
    const groups = view.getUint32(offset + 12);
    for (let g = 0; g < groups; g++) {
      const at = offset + 16 + 12 * g;
      const start = view.getUint32(at), end = view.getUint32(at + 4);
      for (let c = start; c <= end && c < 0x110000; c++) covered.add(c);
    }
  } else {
    const segments = view.getUint16(offset + 6) / 2;
    const endCodes = offset + 14, startCodes = endCodes + segments * 2 + 2;
    const deltas = startCodes + segments * 2, rangeOffsets = deltas + segments * 2;
    for (let s = 0; s < segments; s++) {
      const end = view.getUint16(endCodes + 2 * s), start = view.getUint16(startCodes + 2 * s);
      const delta = view.getUint16(deltas + 2 * s), rangeOffset = view.getUint16(rangeOffsets + 2 * s);
      for (let c = start; c <= end && c !== 0xffff; c++) {
        let glyph;
        if (rangeOffset === 0) glyph = (c + delta) & 0xffff;
        else {
          glyph = view.getUint16(rangeOffsets + 2 * s + rangeOffset + 2 * (c - start));
          if (glyph) glyph = (glyph + delta) & 0xffff;
        }
        if (glyph) covered.add(c);
      }
    }
  }
  return covered;
}

const INVISIBLE = /[​-‍⁠︀-️­]/g;
const PICTOGRAPHS = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/gu;

/** Makes text safe to draw: no emoji or hidden characters, and "?" in place of anything the font lacks (never an empty box). */
export function sanitize(text, covered) {
  let out = String(text ?? '').normalize('NFC').replace(/\r\n?/g, '\n').replace(/\t/g, ' ');
  out = out.replace(INVISIBLE, '').replace(PICTOGRAPHS, '');
  let result = '';
  for (const ch of out) {
    const cp = ch.codePointAt(0);
    if (ch === '\n') result += ch;
    else if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) continue;
    else result += !covered || covered.has(cp) ? ch : '?';
  }
  return result;
}

/**
 * Breaks text into lines no wider than maxWidth (mm). Words are kept whole, a single word that is too long is
 * broken, and blank lines in the comment are kept (but never more than one in a row).
 */
export function wrap(measure, text, maxWidth) {
  const lines = [];
  for (const paragraph of text.split('\n')) {
    if (!paragraph.trim()) { if (lines.length && lines[lines.length - 1] !== '') lines.push(''); continue; }
    let current = '';
    for (const word of paragraph.trim().split(/\s+/)) {
      const attempt = current ? `${current} ${word}` : word;
      if (measure(attempt) <= maxWidth) { current = attempt; continue; }
      if (current) lines.push(current);
      current = '';
      let rest = word;
      while (measure(rest) > maxWidth) {                 // a word wider than the line (a long URL, say): split it
        let cut = rest.length;
        while (cut > 1 && measure(rest.slice(0, cut)) > maxWidth) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      current = rest;
    }
    lines.push(current);
  }
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** Shortens text with an ellipsis so it fits on one line. */
export function fit(measure, text, maxWidth) {
  if (measure(text) <= maxWidth) return text;
  let end = text.length;
  while (end > 1 && measure(`${text.slice(0, end).trimEnd()}…`) > maxWidth) end--;
  return `${text.slice(0, end).trimEnd()}…`;
}
