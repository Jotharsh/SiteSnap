// Inter is bundled with the app (fonts/), so reports look the same everywhere, work offline, and draw engineering symbols (Ø ≥ ≤ ± ² ³).
import { parseCmap } from './text.js';

const FILES = { normal: 'fonts/Inter-Regular.ttf', bold: 'fonts/Inter-SemiBold.ttf' };
let loading;

export function loadFonts() {
  loading ??= (async () => {
    const buffers = {};
    for (const [style, path] of Object.entries(FILES)) {
      const response = await fetch(new URL(`../../${path}`, import.meta.url));
      if (!response.ok) throw new Error(`Could not load the report font (${path}).`);
      buffers[style] = await response.arrayBuffer();
    }
    return { buffers, covered: parseCmap(buffers.normal) };
  })().catch((error) => { loading = undefined; throw error; });
  return loading;
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Registers Inter with a jsPDF document ("normal" = Regular, "bold" = SemiBold). */
export function registerWithPdf(doc, fonts) {
  for (const [style, path] of Object.entries(FILES)) {
    const name = path.split('/').pop();
    doc.addFileToVFS(name, toBase64(fonts.buffers[style]));
    doc.addFont(name, 'Inter', style);
  }
}

/** Makes Inter available to the canvas preview so it matches the PDF. */
export async function registerWithPage(fonts) {
  const weights = { normal: '400', bold: '600' };
  for (const [style, buffer] of Object.entries(fonts.buffers)) {
    const face = new FontFace('Inter', buffer.slice(0), { weight: weights[style] });
    await face.load();
    document.fonts.add(face);
  }
}
