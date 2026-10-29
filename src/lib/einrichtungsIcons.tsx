import type { Enums } from './database.types';

type Typ = Enums<'einrichtung_typ'>;

// Linien-Symbole (24×24) für die Reviereinrichtungen – weiß auf farbigem Grund
export const EINRICHTUNGS_PFADE: Record<Typ, string> = {
  hochsitz: 'M6 3h12v7H6zM8 10l-3 11M16 10l3 11M6.6 15h10.8M5.7 18.5h12.6',
  kanzel: 'M3.5 9.5 12 4l8.5 5.5M6 9.5V15h12V9.5M8.5 15 6 21M15.5 15 18 21M10 11.5h4',
  ansitzleiter: 'M8 3 6 21M16 3l2 18M7.2 8h9.6M6.6 13h10.8M6 18h12',
  bodensitz: 'M3 20 12 6l9 14zM12 20v-6M8.5 20l3.5-6 3.5 6',
  kirrung: 'M4 11h16l-2 8H6zM8 11c0-3.4 1.8-6 4-6s4 2.6 4 6',
  salzlecke: 'M5 8.5 12 5l7 3.5v7L12 19l-7-3.5zM5 8.5l7 3.5 7-3.5M12 12v7',
  fuetterung: 'M3.5 8h17M6 8l1.2 12M18 8l-1.2 12M10 8v12M14 8v12M3.5 8 5 4.5h14L20.5 8',
  wildacker: 'M12 21v-9M12 12.5C12 8 8.8 5.5 4.5 5.5 4.5 10 7 12.5 12 12.5ZM12 15c0-3.4 2.4-5.5 7-5.5 0 3.6-2.6 5.5-7 5.5Z',
  wildkamera: 'M3.5 8h4l1.8-3h5.4l1.8 3h4v11h-17zM12 10.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4z',
  falle: 'M3 11h18v8H3zM3 11l3-5h12l3 5M8 11v8M12 11v8M16 11v8',
  sonstiges: 'M7 21V4M7 5h11l-2.5 4 2.5 4H7',
};

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
  const s = (px * 0.64) / 24;
  g.translate(px / 2 - 12 * s, px / 2 - 12 * s);
  g.scale(s, s);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 2.3;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.stroke(new Path2D(EINRICHTUNGS_PFADE[typ]));
  return g.getImageData(0, 0, px, px);
}

export function EinrichtungsIcon({ typ, farbe, groesse = 20 }: { typ: Typ; farbe: string; groesse?: number }) {
  return (
    <svg width={groesse} height={groesse} viewBox="-3 -3 30 30" aria-hidden="true" style={{ flex: 'none' }}>
      <circle cx="12" cy="12" r="14" fill={farbe} />
      <circle cx="12" cy="12" r="13.2" fill="none" stroke="#fff" strokeWidth="1.2" />
      <path d={EINRICHTUNGS_PFADE[typ]} fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" transform="translate(3.6 3.6) scale(0.7)" />
    </svg>
  );
}
