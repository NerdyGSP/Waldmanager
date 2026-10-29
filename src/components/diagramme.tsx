// Schlanke Diagramme ohne Fremdbibliothek, Farben über CSS-Variablen (hell/dunkel)

export function Balken({
  zeilen,
  einheit = '',
  hervorheben,
}: {
  zeilen: Array<{ label: string; wert: number; zusatz?: string; schluessel?: string }>;
  einheit?: string;
  hervorheben?: (schluessel: string) => 'eigen' | 'schnitt' | null;
}) {
  const max = Math.max(...zeilen.map((z) => z.wert), 0) || 1;
  return (
    <div className="balken">
      {zeilen.map((z) => {
        const art = z.schluessel && hervorheben ? hervorheben(z.schluessel) : null;
        return (
          <div key={z.schluessel ?? z.label} className={`balken-zeile ${art ?? ''}`}>
            <span className="balken-label">{z.label}</span>
            <span className="balken-spur">
              <span className="balken-wert" style={{ width: `${(z.wert / max) * 100}%` }} />
            </span>
            <span className="balken-zahl">
              {z.wert.toLocaleString('de-DE', { maximumFractionDigits: 2 })}
              {einheit}
              {z.zusatz && <small>{z.zusatz}</small>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function Verlauf({ punkte, titel }: { punkte: Array<{ label: string; wert: number }>; titel: string }) {
  if (punkte.length === 0) return null;
  const B = 640;
  const H = 220;
  const rand = { l: 36, r: 16, o: 16, u: 34 };
  const max = Math.max(...punkte.map((p) => p.wert), 1);
  const schritte = niceSchritte(max);
  const oben = schritte[schritte.length - 1] ?? max;
  const x = (i: number) => rand.l + (punkte.length === 1 ? (B - rand.l - rand.r) / 2 : (i / (punkte.length - 1)) * (B - rand.l - rand.r));
  const y = (v: number) => H - rand.u - (v / oben) * (H - rand.o - rand.u);
  const linie = punkte.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.wert).toFixed(1)}`).join(' ');
  const jedes = Math.ceil(punkte.length / 8);

  return (
    <svg className="verlauf" viewBox={`0 0 ${B} ${H}`} role="img" aria-label={titel}>
      {schritte.map((s) => (
        <g key={s}>
          <line x1={rand.l} x2={B - rand.r} y1={y(s)} y2={y(s)} className="gitter" />
          <text x={rand.l - 8} y={y(s) + 4} textAnchor="end" className="achse">
            {s}
          </text>
        </g>
      ))}
      <path d={linie} className="linie" />
      {punkte.map((p, i) => (
        <g key={`${p.label}-${i}`}>
          <circle cx={x(i)} cy={y(p.wert)} r="4" className="punkt">
            <title>{`${p.label}: ${p.wert}`}</title>
          </circle>
          {i % jedes === 0 && (
            <text x={x(i)} y={H - 10} textAnchor={i === punkte.length - 1 && punkte.length > 2 ? 'end' : 'middle'} className="achse">
              {p.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function niceSchritte(max: number): number[] {
  const roh = max / 4;
  const potenz = 10 ** Math.floor(Math.log10(roh));
  const faktor = [1, 2, 2.5, 5, 10].find((f) => f * potenz >= roh) ?? 10;
  const schritt = Math.max(1, faktor * potenz);
  const liste: number[] = [];
  for (let v = 0; v <= max + schritt * 0.999; v += schritt) liste.push(Math.round(v * 100) / 100);
  return liste;
}

export const SERIENFARBEN = ['#1e5c3a', '#f26a1b', '#1f6fb2', '#8e44ad', '#5d6d7e', '#c0392b', '#16a085'];
const SERIENSTRICH = ['', '7 4', '2 4', '10 4 2 4', '4 4', '1 5', '12 3'];
const MONATE = ['Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez', 'Jan', 'Feb', 'Mär'];
const MONATSSTART = [0, 30, 61, 91, 122, 153, 183, 214, 244, 275, 306, 334, 365];

export type Serie = { id: string; label: string; punkte: Array<{ x: number; wert: number; titel: string }> };

/** Mehrere Jagdjahre übereinander: x = Tag im Jagdjahr (1. April bis 31. März), eine Linie je Serie */
export function VerlaufMehrere({ serien, titel, hervorgehoben }: { serien: Serie[]; titel: string; hervorgehoben?: string }) {
  const B = 760;
  const H = 300;
  const rand = { l: 40, r: 16, o: 14, u: 30 };
  const alle = serien.flatMap((s) => s.punkte);
  if (alle.length === 0) return null;
  const max = Math.max(...alle.map((p) => p.wert), 1);
  const schritte = niceSchritte(max);
  const oben = schritte[schritte.length - 1] ?? max;
  const x = (tag: number) => rand.l + (tag / 365) * (B - rand.l - rand.r);
  const y = (v: number) => H - rand.u - (v / oben) * (H - rand.o - rand.u);

  return (
    <div className="verlauf-mehrere">
      <svg className="verlauf" viewBox={`0 0 ${B} ${H}`} role="img" aria-label={titel}>
        {schritte.map((s) => (
          <g key={s}>
            <line x1={rand.l} x2={B - rand.r} y1={y(s)} y2={y(s)} className="gitter" />
            <text x={rand.l - 8} y={y(s) + 4} textAnchor="end" className="achse">
              {s}
            </text>
          </g>
        ))}
        {MONATE.map((m, i) => (
          <text key={m} x={x((MONATSSTART[i]! + MONATSSTART[i + 1]!) / 2)} y={H - 8} textAnchor="middle" className="achse">
            {m}
          </text>
        ))}
        {serien.map((s, i) => {
          const sortiert = [...s.punkte].sort((a, b) => a.x - b.x);
          const farbe = SERIENFARBEN[i % SERIENFARBEN.length];
          const stark = hervorgehoben === s.id;
          return (
            <g key={s.id} stroke={farbe} fill="none">
              <path
                d={sortiert.map((p, j) => `${j === 0 ? 'M' : 'L'}${x(p.x).toFixed(1)} ${y(p.wert).toFixed(1)}`).join(' ')}
                strokeWidth={stark ? 3 : 2}
                strokeDasharray={SERIENSTRICH[i % SERIENSTRICH.length]}
                strokeLinejoin="round"
              />
              {sortiert.map((p, j) => (
                <circle key={j} cx={x(p.x)} cy={y(p.wert)} r={stark ? 4.5 : 3.5} className="serienpunkt" style={{ fill: 'var(--color-surface)' }}>
                  <title>{`${s.label} · ${p.titel}: ${p.wert.toLocaleString('de-DE', { maximumFractionDigits: 1 })}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      <ul className="serien-legende">
        {serien.map((s, i) => (
          <li key={s.id}>
            <svg width="26" height="10" aria-hidden="true">
              <line x1="0" x2="26" y1="5" y2="5" stroke={SERIENFARBEN[i % SERIENFARBEN.length]} strokeWidth="3" strokeDasharray={SERIENSTRICH[i % SERIENSTRICH.length]} />
            </svg>
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
