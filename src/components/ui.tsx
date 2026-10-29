import { navigieren } from '../lib/router';
import { Fragment, createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

export function Gruppe({ titel, fuss, children }: { titel?: string; fuss?: ReactNode; children: ReactNode }) {
  return (
    <section className="gruppe">
      {titel && <h2 className="gruppe-titel">{titel}</h2>}
      <div className="gruppe-inhalt">{children}</div>
      {fuss && <p className="gruppe-fuss">{fuss}</p>}
    </section>
  );
}

type FeldProps = InputHTMLAttributes<HTMLInputElement> & { label: string };

export function Feld({ label, id, ...rest }: FeldProps) {
  // Eindeutige ID je Feld, damit gleich benannte Felder (z. B. „Name“) sich nicht in die Quere kommen
  const autoId = useId();
  const feldId = id ?? autoId;
  return (
    <label className="zeile feld" htmlFor={feldId}>
      <span className="zeile-label">{label}</span>
      <input id={feldId} {...rest} />
    </label>
  );
}

type PasswortProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string };

// Passwortfeld mit Umschalter zum Ein-/Ausblenden der Eingabe
export function PasswortFeld({ label, id, ...rest }: PasswortProps) {
  const autoId = useId();
  const feldId = id ?? autoId;
  const [sichtbar, setSichtbar] = useState(false);
  return (
    <div className="zeile feld passwort-feld">
      <label className="zeile-label" htmlFor={feldId}>
        {label}
      </label>
      <input id={feldId} type={sichtbar ? 'text' : 'password'} autoCapitalize="none" spellCheck={false} {...rest} />
      <button
        type="button"
        className="auge"
        onClick={() => setSichtbar((s) => !s)}
        aria-label={sichtbar ? 'Passwort verbergen' : 'Passwort anzeigen'}
        aria-pressed={sichtbar}
      >
        {sichtbar ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.8 9.8 0 0112 5c5 0 9 4.5 10 7-.4 1-1.3 2.4-2.6 3.7M6.6 6.6C4.4 8 2.8 10.1 2 12c1 2.5 5 7 10 7 1.6 0 3.1-.4 4.4-1.1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}

type AuswahlProps = SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode };

export function Auswahl({ label, id, children, ...rest }: AuswahlProps) {
  const autoId = useId();
  const feldId = id ?? autoId;
  return (
    <label className="zeile feld" htmlFor={feldId}>
      <span className="zeile-label">{label}</span>
      <select id={feldId} {...rest}>
        {children}
      </select>
    </label>
  );
}

export function Zeile({ label, wert, children }: { label: ReactNode; wert?: ReactNode; children?: ReactNode }) {
  return (
    <div className="zeile">
      <span className="zeile-label">{label}</span>
      {wert !== undefined && <span className="zeile-wert">{wert}</span>}
      {children}
    </div>
  );
}

type KnopfProps = ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'akzent' | 'primaer' | 'sekundaer' | 'ghost' | 'gefahr' };

export function Knopf({ variante = 'primaer', className, ...rest }: KnopfProps) {
  return <button className={`knopf knopf-${variante} ${className ?? ''}`} {...rest} />;
}

export function Hinweis({ art = 'info', children }: { art?: 'info' | 'fehler' | 'erfolg'; children: ReactNode }) {
  return (
    <div className={`hinweis hinweis-${art}`} role={art === 'fehler' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

// In der Desktop-Seitenleiste stellt die Leiste selbst den Titel dar
export const EingebettetKontext = createContext(false);

export function Seite({
  titel,
  untertitel,
  aktion,
  zurueck,
  children,
}: {
  titel: string;
  untertitel?: ReactNode;
  aktion?: ReactNode;
  zurueck?: () => void;
  children: ReactNode;
}) {
  const eingebettet = useContext(EingebettetKontext);
  if (eingebettet) {
    // Unteransichten (mit eigenem Zurück) behalten ihren Titel, Modul-Startseiten nicht
    return (
      <div className="seite seite-eingebettet">
        {(zurueck || untertitel || aktion) && (
          <div className="seite-kopf">
            {zurueck && (
              <button className="zurueck" onClick={zurueck} aria-label="Zurück">
                ‹ Zurück
              </button>
            )}
            <div className="seite-titel">
              {zurueck && <h2>{titel}</h2>}
              {untertitel && <p>{untertitel}</p>}
            </div>
            {aktion && <div className="seite-aktion">{aktion}</div>}
          </div>
        )}
        {children}
      </div>
    );
  }
  return (
    <div className="seite">
      <div className="seite-kopf">
        <button className="zurueck" onClick={zurueck ?? (() => navigieren('/'))} aria-label="Zurück">
          ‹ Zurück
        </button>
        <div className="seite-titel">
          <h1>{titel}</h1>
          {untertitel && <p>{untertitel}</p>}
        </div>
        {aktion && <div className="seite-aktion">{aktion}</div>}
      </div>
      {children}
    </div>
  );
}

export function Zaehler({
  wert,
  onAendern,
  min = 0,
  label,
}: {
  wert: number;
  onAendern: (neu: number) => void;
  min?: number;
  label: string;
}) {
  return (
    <div className="zaehler" role="group" aria-label={label}>
      <button type="button" onClick={() => onAendern(Math.max(min, wert - 1))} disabled={wert <= min} aria-label={`${label} verringern`}>
        −
      </button>
      <output aria-live="polite">{wert}</output>
      <button type="button" onClick={() => onAendern(wert + 1)} aria-label={`${label} erhöhen`}>
        +
      </button>
    </div>
  );
}

export function Segmente<T extends string>({
  optionen,
  wert,
  onAendern,
  label,
}: {
  optionen: Array<{ wert: T; label: string }>;
  wert: T;
  onAendern: (neu: T) => void;
  label: string;
}) {
  return (
    <div className="segmente" role="radiogroup" aria-label={label}>
      {optionen.map((o) => (
        <button
          key={o.wert}
          type="button"
          role="radio"
          aria-checked={o.wert === wert}
          onClick={() => onAendern(o.wert)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Leer({ children }: { children: ReactNode }) {
  return <p className="leer">{children}</p>;
}

export function CodeAnzeige({ code, beschreibung }: { code: string; beschreibung: ReactNode }) {
  async function kopieren() {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      /* Zwischenablage nicht verfügbar */
    }
  }
  return (
    <div className="code-anzeige">
      <div className="code-wert">{code}</div>
      <p>{beschreibung}</p>
      <Knopf variante="sekundaer" type="button" onClick={kopieren}>
        Code kopieren
      </Knopf>
    </div>
  );
}

/** Farbwahl, die erst nach kurzer Pause speichert (der Farbwähler feuert beim Ziehen laufend) */
export function Farbwahl({ wert, label, onAendern }: { wert: string; label: string; onAendern: (farbe: string) => void }) {
  const [lokal, setLokal] = useState(wert);
  const timer = useRef<number | null>(null);
  useEffect(() => setLokal(wert), [wert]);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  return (
    <input
      type="color"
      className="farbwahl"
      aria-label={label}
      value={lokal}
      onChange={(e) => {
        const neu = e.target.value;
        setLokal(neu);
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => onAendern(neu), 450);
      }}
    />
  );
}

// Mausrad scrollt eine horizontale Leiste (Desktop-Browser kennen sonst nur Shift+Rad)
export function useRadHorizontal<T extends HTMLElement>() {
  const aufraeumen = useRef<(() => void) | null>(null);
  return useCallback((el: T | null) => {
    aufraeumen.current?.();
    aufraeumen.current = null;
    if (!el) return;
    const rad = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    el.addEventListener('wheel', rad, { passive: false });
    aufraeumen.current = () => el.removeEventListener('wheel', rad);
  }, []);
}

// Hauptwildarten (Sortierung < 10) zuerst, danach Trennlinie und der Rest
export const HAUPTWILDARTEN_BIS = 10;
export function WildartOptionen({ wildarten }: { wildarten: Array<{ id: string; name: string; sortierung: number }> }) {
  return (
    <>
      {wildarten.map((w, i) => (
        <Fragment key={w.id}>
          {i > 0 && w.sortierung >= HAUPTWILDARTEN_BIS && wildarten[i - 1]!.sortierung < HAUPTWILDARTEN_BIS && (
            <option disabled value="__trenner">
              ----------
            </option>
          )}
          <option value={w.id}>{w.name}</option>
        </Fragment>
      ))}
    </>
  );
}
