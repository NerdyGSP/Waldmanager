import qrcode from 'qrcode-generator';

// QR-Code als SVG (schwarz auf weiß, mit Ruhezone), gut druckbar
export function QrCode({ text, groesse = 120, titel }: { text: string; groesse?: number; titel?: string }) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const rand = 2;
  const zellen: string[] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) zellen.push(`M${x + rand} ${y + rand}h1v1h-1z`);
  return (
    <svg width={groesse} height={groesse} viewBox={`0 0 ${n + rand * 2} ${n + rand * 2}`} role="img" aria-label={titel ?? 'QR-Code'} shapeRendering="crispEdges">
      <rect width="100%" height="100%" fill="#fff" />
      <path d={zellen.join('')} fill="#000" />
    </svg>
  );
}
