// Turns a camera or gallery photo into a small JPEG that is upright and cheap to store.
// A 12-megapixel phone photo is ~4 MB; the stored version is about 150-300 KB.
export const MAX_SIDE = 1600;     // longest side of the stored photo, in pixels
export const THUMB_SIDE = 360;    // longest side of the list thumbnail
export const QUALITY = 0.7;

/** Reads the EXIF "Orientation" tag (1 to 8) from the start of a JPEG. 1 means upright, or unknown. */
export function parseOrientation(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;
  let p = 2;
  while (p + 4 < bytes.length) {
    if (bytes[p] !== 0xff) return 1;
    const marker = bytes[p + 1];
    if (marker === 0xda || marker === 0xd9) return 1;           // image data starts: there was no EXIF block
    const length = (bytes[p + 2] << 8) | bytes[p + 3];
    const isExif = marker === 0xe1 && bytes[p + 4] === 0x45 && bytes[p + 5] === 0x78 && bytes[p + 6] === 0x69
      && bytes[p + 7] === 0x66 && bytes[p + 8] === 0 && bytes[p + 9] === 0;
    if (isExif) {
      const t = p + 10;                                          // start of the TIFF header
      const little = bytes[t] === 0x49;                          // "II" = little endian, "MM" = big endian
      const u16 = (o) => (little ? bytes[o] | (bytes[o + 1] << 8) : (bytes[o] << 8) | bytes[o + 1]);
      const u32 = (o) => (little
        ? (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0
        : ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0);
      const ifd = t + u32(t + 4);
      const count = u16(ifd);
      for (let i = 0; i < count; i++) {
        const entry = ifd + 2 + i * 12;
        if (u16(entry) === 0x0112) { const v = u16(entry + 8); return v >= 1 && v <= 8 ? v : 1; }
      }
      return 1;
    }
    p += 2 + length;
  }
  return 1;
}

/** Inserts an EXIF block saying "rotate 90 degrees" into a JPEG. Used only to test the browser (and by the tests). */
export function withExifOrientation(jpegBytes, orientation) {
  const exif = Uint8Array.from([
    0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,                     // APP1 "Exif"
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,                                 // TIFF header, big endian, IFD at 8
    0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00,   // 1 entry: Orientation
    0x00, 0x00, 0x00, 0x00,                                                         // no next IFD
  ]);
  const out = new Uint8Array(jpegBytes.length + exif.length);
  out.set(jpegBytes.subarray(0, 2), 0);
  out.set(exif, 2);
  out.set(jpegBytes.subarray(2), 2 + exif.length);
  return out;
}

const toBlob = (canvas, type, quality) => new Promise((resolve, reject) =>
  canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The photo could not be saved.'))), type, quality));

async function loadImage(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { img, release: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw new Error('That photo could not be read. Please try another one.');
  }
}

let autoRotates;
/** Do this browser's <img> and canvas apply EXIF rotation by themselves? Newer ones do; older ones do not. Found out once, by testing. */
export function browserRotatesExif() {
  autoRotates ??= (async () => {
    try {
      const canvas = Object.assign(document.createElement('canvas'), { width: 2, height: 1 });
      canvas.getContext('2d').fillRect(0, 0, 2, 1);
      const bytes = new Uint8Array(await (await toBlob(canvas, 'image/jpeg', 0.9)).arrayBuffer());
      const { img, release } = await loadImage(new Blob([withExifOrientation(bytes, 6)], { type: 'image/jpeg' }));
      const rotated = img.naturalWidth === 1 && img.naturalHeight === 2;       // 2x1 turned 90 degrees is 1x2
      release();
      return rotated;
    } catch { return true; }
  })();
  return autoRotates;
}

function orientationTransform(o, w, h) {
  return { 2: [-1, 0, 0, 1, w, 0], 3: [-1, 0, 0, -1, w, h], 4: [1, 0, 0, -1, 0, h], 5: [0, 1, 1, 0, 0, 0],
           6: [0, 1, -1, 0, h, 0], 7: [0, -1, -1, 0, h, w], 8: [0, -1, 1, 0, 0, w] }[o];
}

/**
 * Decodes an image, turns it the right way up, and draws it onto a canvas no larger than `maxSide`.
 * `assumeAutoRotated` and `forceOrientation` exist so the tests can exercise the by-hand rotation path in a browser that rotates by itself.
 */
async function renderUpright(file, { maxSide, fill, assumeAutoRotated, forceOrientation }) {
  const manual = !(assumeAutoRotated ?? await browserRotatesExif());
  const orientation = forceOrientation ?? (manual ? parseOrientation(new Uint8Array(await file.slice(0, 131072).arrayBuffer())) : 1);

  const { img, release } = await loadImage(file);
  try {
    const sw = img.naturalWidth, sh = img.naturalHeight;                    // stored (unrotated) size when we rotate by hand
    const ow = orientation >= 5 ? sh : sw, oh = orientation >= 5 ? sw : sh; // size as it should appear
    const scale = Math.min(1, maxSide / Math.max(ow, oh));
    const width = Math.max(1, Math.round(ow * scale)), height = Math.max(1, Math.round(oh * scale));

    const canvas = Object.assign(document.createElement('canvas'), { width, height });
    const ctx = canvas.getContext('2d', { willReadFrequently: !fill });
    if (fill) { ctx.fillStyle = fill; ctx.fillRect(0, 0, width, height); }   // JPEG has no transparency: transparent areas become white, not black
    ctx.imageSmoothingQuality = 'high';
    ctx.scale(scale, scale);
    if (orientation > 1) ctx.transform(...orientationTransform(orientation, sw, sh));
    ctx.drawImage(img, 0, 0);
    return { canvas, width, height };
  } finally {
    release();
  }
}

/**
 * @param {Blob} file  a photo from the camera or gallery
 * @returns {{photo: Blob, thumb: Blob, width: number, height: number}}  upright JPEGs, longest side <= 1600 px (thumbnail 360 px)
 */
export async function processPhoto(file, options = {}) {
  const { canvas, width, height } = await renderUpright(file, { maxSide: MAX_SIDE, fill: '#fff', ...options });
  const photo = await toBlob(canvas, 'image/jpeg', QUALITY);
  const ts = Math.min(1, THUMB_SIDE / Math.max(width, height));
  const small = Object.assign(document.createElement('canvas'), { width: Math.max(1, Math.round(width * ts)), height: Math.max(1, Math.round(height * ts)) });
  small.getContext('2d').drawImage(canvas, 0, 0, small.width, small.height);
  const thumb = await toBlob(small, 'image/jpeg', QUALITY);
  canvas.width = canvas.height = small.width = small.height = 0;          // let go of the pixel memory straight away (matters on phones)
  return { photo, thumb, width, height };
}

/**
 * Makes paper-coloured pixels see-through, keeping the ink. The paper brightness is worked out locally (the brightest nearby area),
 * so a photo with shadows or uneven light still comes out clean. Ink is thin, so it never dominates a neighbourhood.
 */
export function keyOutPaper(data, width, height) {
  const lum = new Float32Array(width * height);
  for (let i = 0; i < lum.length; i++) lum[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];

  const block = Math.max(8, Math.round(Math.max(width, height) / 20));       // bigger than any pen stroke
  const cols = Math.ceil(width / block), rows = Math.ceil(height / block);
  const peak = new Float32Array(cols * rows);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const cell = Math.floor(y / block) * cols + Math.floor(x / block);
    if (lum[y * width + x] > peak[cell]) peak[cell] = lum[y * width + x];
  }
  const paper = new Float32Array(cols * rows);                               // brightest of each block and its neighbours
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    let m = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) m = Math.max(m, peak[rr * cols + cc]);
    }
    paper[r * cols + c] = m;
  }
  const at = (r, c) => paper[Math.min(rows - 1, Math.max(0, r)) * cols + Math.min(cols - 1, Math.max(0, c))];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    // smooth the paper estimate between block centres, so there are no visible steps
    const fy = y / block - 0.5, fx = x / block - 0.5;
    const r0 = Math.floor(fy), c0 = Math.floor(fx), ty = fy - r0, tx = fx - c0;
    const bg = (at(r0, c0) * (1 - tx) + at(r0, c0 + 1) * tx) * (1 - ty) + (at(r0 + 1, c0) * (1 - tx) + at(r0 + 1, c0 + 1) * tx) * ty;
    const ratio = bg > 1 ? lum[y * width + x] / bg : 1;                      // 1 = paper, near 0 = dark ink
    const alpha = Math.min(1, Math.max(0, (0.88 - ratio) / 0.34));
    const i = (y * width + x) * 4;
    data[i + 3] = Math.round(data[i + 3] * alpha);
  }
  return data;
}

/** A logo or signature: a small PNG that keeps transparency. */
export async function processBrandImage(file, { maxSide = 600, signature = false } = {}) {
  const { canvas } = await renderUpright(file, { maxSide, fill: null });
  if (signature) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    keyOutPaper(pixels.data, canvas.width, canvas.height);
    ctx.putImageData(pixels, 0, 0);
  }
  const blob = await toBlob(canvas, 'image/png');
  canvas.width = canvas.height = 0;
  return blob;
}

/** A small thumbnail for the visit list, made from an existing (already upright) photo. Also reports the photo's own size. */
export async function makeThumbnail(blob) {
  const bitmap = await createImageBitmap(blob);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close?.();
  const { canvas } = await renderUpright(blob, { maxSide: THUMB_SIDE, fill: '#fff', assumeAutoRotated: true });
  const thumb = await toBlob(canvas, 'image/jpeg', QUALITY);
  canvas.width = canvas.height = 0;
  return { thumb, ...size };
}
