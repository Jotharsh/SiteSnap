// Draws the layout's instructions into a jsPDF document. All the "where" decisions were already made in layout.js.
export function renderPdf(doc, layout, properties = {}) {
  layout.pages.forEach((page, index) => {
    if (index > 0) doc.addPage();
    for (const op of page.ops) draw(doc, op);
  });
  doc.setProperties({ creator: 'SiteSnap', ...properties });
  return doc.output('blob');
}

function draw(doc, op) {
  switch (op.t) {
    case 'text':
      doc.setFont('Inter', op.bold ? 'bold' : 'normal');
      doc.setFontSize(op.size);
      doc.setTextColor(...op.color);
      doc.text(op.str, op.x, op.y, { align: op.align, baseline: 'alphabetic' });
      break;
    case 'rect': {
      const style = op.fill && op.stroke ? 'FD' : op.fill ? 'F' : 'S';
      if (op.fill) doc.setFillColor(...op.fill);
      if (op.stroke) { doc.setDrawColor(...op.stroke); doc.setLineWidth(op.lw ?? 0.25); }
      if (op.radius) doc.roundedRect(op.x, op.y, op.w, op.h, op.radius, op.radius, style);
      else doc.rect(op.x, op.y, op.w, op.h, style);
      break;
    }
    case 'line':
      doc.setDrawColor(...op.color);
      doc.setLineWidth(op.lw ?? 0.25);
      doc.line(op.x1, op.y1, op.x2, op.y2);
      break;
    case 'circle':
      doc.setFillColor(...op.fill);
      doc.circle(op.x, op.y, op.r, 'F');
      break;
    case 'image':
      doc.addImage(op.asset.bytes, op.asset.format, op.x, op.y, op.w, op.h, op.asset.id, 'NONE');
      break;
  }
}
