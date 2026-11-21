import { BAUMARTEN, type Baumartenanteil } from '../lib/stammdaten';
import { anteilSumme, baumartenPruefen } from '../lib/forst';
import { Gruppe } from './ui';

/** Eingabe einer Baumartenmischung (Art + Anteil in %), für Bestände und Zonen */
export function BaumartenEingabe({
  wert,
  onAendern,
  darf,
  titel = 'Baumarten',
}: {
  wert: Baumartenanteil[];
  onAendern: (neu: Baumartenanteil[] | ((alt: Baumartenanteil[]) => Baumartenanteil[])) => void;
  darf: boolean;
  titel?: string;
}) {
  const fehler = baumartenPruefen(wert);
  const freieArten = (aktuell: string) => BAUMARTEN.filter((b) => b.kuerzel === aktuell || !wert.some((m) => m.art === b.kuerzel));
  return (
    <Gruppe titel={titel} fuss={wert.length ? `Summe ${anteilSumme(wert)} %${fehler ? ` – ${fehler}` : ''}` : 'Noch keine Baumarten eingetragen.'}>
      {wert.map((m, i) => (
        <div key={i} className="zeile baumart-zeile">
          <select
            aria-label={`Baumart ${i + 1}`}
            disabled={!darf}
            value={m.art}
            onChange={(e) => onAendern((alt) => alt.map((x, j) => (j === i ? { ...x, art: e.target.value } : x)))}
          >
            <option value="">Baumart wählen</option>
            {freieArten(m.art).map((b) => (
              <option key={b.kuerzel} value={b.kuerzel}>
                {b.name} ({b.kuerzel})
              </option>
            ))}
          </select>
          <input
            aria-label={`Anteil ${i + 1} in Prozent`}
            inputMode="numeric"
            disabled={!darf}
            value={String(m.anteil)}
            onChange={(e) => onAendern((alt) => alt.map((x, j) => (j === i ? { ...x, anteil: Number(e.target.value.replace(/\D/g, '') || 0) } : x)))}
          />
          <span>%</span>
          {darf && (
            <button type="button" className="link gefahr" onClick={() => onAendern((alt) => alt.filter((_, j) => j !== i))}>
              Entfernen
            </button>
          )}
        </div>
      ))}
      {darf && wert.length < BAUMARTEN.length && (
        <div style={{ padding: '8px var(--abstand)' }}>
          <button type="button" className="link" onClick={() => onAendern((alt) => [...alt, { art: '', anteil: Math.max(0, 100 - anteilSumme(alt)) }])}>
            + Baumart hinzufügen
          </button>
        </div>
      )}
    </Gruppe>
  );
}

/** Farbbalken der Mischung */
export function MischungsBalken({ wert }: { wert: Baumartenanteil[] }) {
  return (
    <div className="mischung-balken" role="img" aria-label={wert.map((b) => `${b.art} ${b.anteil} %`).join(', ')}>
      {wert.map((b) => (
        <span key={b.art} style={{ width: `${b.anteil}%` }} data-art={b.art} />
      ))}
    </div>
  );
}
