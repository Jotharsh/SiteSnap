import { getSettings } from './db.js';

/** Applies the user's accent colour everywhere through one CSS variable, picking readable text for it. */
export async function applyAccent(settings) {
  const { accent } = settings ?? await getSettings();
  const hex = /^#[0-9a-f]{6}$/i.test(accent) ? accent : '#c2410c';
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  document.documentElement.style.setProperty('--accent', hex);
  document.documentElement.style.setProperty('--accent-fg', luminance > 0.6 ? '#111111' : '#ffffff');
}
