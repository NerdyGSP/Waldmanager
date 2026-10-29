import { navigieren } from '../lib/router';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

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
  const feldId = id ?? `feld-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <label className="zeile feld" htmlFor={feldId}>
      <span className="zeile-label">{label}</span>
      <input id={feldId} {...rest} />
    </label>
  );
}

type AuswahlProps = SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode };

export function Auswahl({ label, id, children, ...rest }: AuswahlProps) {
  const feldId = id ?? `auswahl-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
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

type KnopfProps = ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'primaer' | 'sekundaer' | 'gefahr' };

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
