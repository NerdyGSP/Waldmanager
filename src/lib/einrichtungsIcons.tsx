import type { Enums } from './database.types';
import { MD3_EINRICHTUNG } from './md3';

type Typ = Enums<'einrichtung_typ'>;

// Material Symbols (MD3, gefüllt) – weiß auf farbigem Grund
export const EINRICHTUNGS_PFADE = MD3_EINRICHTUNG as Record<Typ, string>;

// Wird in die Karte als Bild eingetragen (Kreis + Symbol, 2× aufgelöst)
export function einrichtungsBild(typ: Typ, farbe: string): ImageData {
  const px = 56;
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d')!;
  g.beginPath();
  g.arc(px / 2, px / 2, px / 2 - 2, 0, Math.PI * 2);
  g.fillStyle = farbe;
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = '#ffffff';
  g.stroke();
  const s = (px * 0.66) / 960;
  g.translate(px / 2 - 480 * s, px / 2 + 480 * s);
  g.scale(s, s);
  g.fillStyle = '#ffffff';
  g.fill(new Path2D(EINRICHTUNGS_PFADE[typ]));
  return g.getImageData(0, 0, px, px);
}

export function EinrichtungsIcon({ typ, farbe, groesse = 20 }: { typ: Typ; farbe: string; groesse?: number }) {
  return (
    <svg width={groesse} height={groesse} viewBox="-3 -3 30 30" aria-hidden="true" style={{ flex: 'none' }}>
      <circle cx="12" cy="12" r="14" fill={farbe} />
      <circle cx="12" cy="12" r="13.2" fill="none" stroke="#fff" strokeWidth="1.2" />
      <path d={EINRICHTUNGS_PFADE[typ]} fill="#fff" transform="translate(4.32 19.68) scale(0.016)" />
    </svg>
  );
}
