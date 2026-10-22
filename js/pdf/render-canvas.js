// Paints a page's instructions on a canvas: the on-screen preview. Same data as the PDF, so what you see is what you share.
const PT = 25.4 / 72;
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

/** Decodes each photo once so pages can be painted synchronously (and re-painted when the window resizes). */
export async function prepareImages(layout) {
  const assets = new Set();
  for (const page of layout.pages) for (const op of page.ops) if (op.t === 'image') assets.add(op.asset);
  await Promise.all([...assets].map(async (asset) => {
    asset.bitmap ??= await createImageBitmap(new Blob([asset.bytes], { type: asset.mime }));
  }));
}

export function paintPage(canvas, page, paper, pixelsPerMm) {
  canvas.width = Math.round(paper.w * pixelsPerMm);
  canvas.height = Math.round(paper.h * pixelsPerMm);
  const ctx = canvas.getContext('2d');
  const k = pixelsPerMm;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = 'alphabetic';

  for (const op of page.ops) {
    switch (op.t) {
      case 'text':
        ctx.font = `${op.bold ? 600 : 400} ${op.size * PT * k}px Inter, sans-serif`;
        ctx.fillStyle = rgb(op.color);
        ctx.textAlign = op.align ?? 'left';
        ctx.fillText(op.str, op.x * k, op.y * k);
        break;
      case 'rect':
        ctx.beginPath();
        if (op.radius) ctx.roundRect(op.x * k, op.y * k, op.w * k, op.h * k, op.radius * k);
        else ctx.rect(op.x * k, op.y * k, op.w * k, op.h * k);
        if (op.fill) { ctx.fillStyle = rgb(op.fill); ctx.fill(); }
        if (op.stroke) { ctx.strokeStyle = rgb(op.stroke); ctx.lineWidth = (op.lw ?? 0.25) * k; ctx.stroke(); }
        break;
      case 'line':
        ctx.beginPath();
        ctx.strokeStyle = rgb(op.color);
        ctx.lineWidth = (op.lw ?? 0.25) * k;
        ctx.moveTo(op.x1 * k, op.y1 * k);
        ctx.lineTo(op.x2 * k, op.y2 * k);
        ctx.stroke();
        break;
      case 'circle':
        ctx.beginPath();
        ctx.fillStyle = rgb(op.fill);
        ctx.arc(op.x * k, op.y * k, op.r * k, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'image':
        if (op.asset.bitmap) ctx.drawImage(op.asset.bitmap, op.x * k, op.y * k, op.w * k, op.h * k);
        break;
    }
  }
}
