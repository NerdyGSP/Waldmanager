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
