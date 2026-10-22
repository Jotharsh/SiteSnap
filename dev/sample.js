// Creates a 40-observation test visit in the app's own database (same browser, same site).
import { saveVisit, appendEntry, newId } from '../js/db.js';
import { todayISO } from '../js/ui.js';

const SIZES = [[1600, 1200], [1200, 1600], [1600, 900], [900, 1600], [1200, 1200]];
const LONG = 'Honeycombing observed on the north face of column C7 between levels 2 and 3. '.repeat(14).trim();
const HUGE = Array.from({ length: 22 }, (_, i) => `Paragraph ${i + 1}. The contractor must remove loose material, clean the exposed rebar, and re-pour with non-shrink grout of grade ≥ M40 before the next pour.`).join('\n\n');
const COMMENTS = [
  'Rebar spacing at slab S2: Ø16 @ 150 mm c/c, cover ≥ 25 mm. Tolerance ± 5 mm. Area ≈ 12 m², volume 3.5 m³. Load ≤ 5 kN/m².',
  '',
  LONG,
  'Link: https://example.com/projects/riverside/block-b/level-3/slab-s2/inspection-photos/2026/10/22/IMG_20261022_093045_very_long_name_without_spaces.jpg',
  'Looks good 👍 ✅ and fixed 🏗️ — formwork is OK.',
  'Formwork OK.',
  'Line one.\nLine two after a line break.\n\n\n\nLine three after many blank lines.',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'Waterproofing membrane lapped 150 mm at the upstand; drainage outlet Ø110 clear. Slope ≥ 1:80. Café Zoë, Müller & Søren attended.',
  HUGE,
];
const TAGS = ['urgent', 'fix', 'done', 'note', '', 'fix', 'done'];

function picture(w, h, hue, label) {
  const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const c = canvas.getContext('2d');
  const g = c.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `hsl(${hue},70%,55%)`); g.addColorStop(1, `hsl(${(hue + 60) % 360},70%,30%)`);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 3;
  for (let i = 1; i < 8; i++) { c.beginPath(); c.moveTo((w * i) / 8, 0); c.lineTo((w * i) / 8, h); c.stroke(); c.beginPath(); c.moveTo(0, (h * i) / 8); c.lineTo(w, (h * i) / 8); c.stroke(); }
  c.strokeStyle = '#fff'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8);        // a white edge shows whether a photo is cropped or stretched
  c.fillStyle = '#fff'; c.font = `bold ${Math.round(Math.min(w, h) / 3)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, w / 2, h / 2);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7));
}

const button = document.getElementById('make');
button.addEventListener('click', async () => {
  button.disabled = true;
  const result = document.getElementById('result');
  try {
    const visit = await saveVisit({ id: newId(), project: 'Test visit: 40 observations Ø16 ≥ 25 ± 2 m²', location: 'Level 3, east wing', date: todayISO(), preparedBy: 'Test User' });
    for (let i = 0; i < 40; i++) {
      result.textContent = `Making photo ${i + 1} of 40…`;
      const [w, h] = SIZES[i % SIZES.length];
      const photo = await picture(w, h, (i * 37) % 360, String(i + 1));
      await appendEntry(visit.id, { photo, thumb: photo, width: w, height: h, comment: COMMENTS[i % COMMENTS.length], tag: TAGS[i % TAGS.length], createdAt: Date.now() - (40 - i) * 60000 });
    }
    result.textContent = 'Done. Open SiteSnap, open the new visit, and tap "Make PDF".';
    const open = document.getElementById('open');
    open.href = `../#/visit/${visit.id}`; open.hidden = false;
  } catch (error) {
    console.error(error);
    result.textContent = 'That did not work. Please try again.';
    button.disabled = false;
  }
});
