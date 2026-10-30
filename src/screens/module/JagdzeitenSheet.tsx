import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  MONATE_SKALA,
  JAGDJAHR_TAGE,
  RECHTSHINWEIS,
  STATUS_TEXT,
  klassen,
  monatTag,
  statusKlasse,
  tagImJagdjahr,
  zeitraumLang,
  zeitraeume,
  type Jagdzeit,
  type Zeitraum,
} from '../../lib/jagdzeiten';
import { datumDE } from '../../lib/zeit';
import { Einklappbar } from '../../components/ui';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const langDatum = (d: Date) => d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });

/** Jahresbalken 1. April – 31. März; kompakt = 10 px ohne Buchstaben */
export function Jahresbalken({ segmente, stichtag, kompakt, label }: { segmente: Zeitraum[]; stichtag: Date; kompakt?: boolean; label: string }) {
  const pos = tagImJagdjahr(monatTag(stichtag));
  return (
    <div className={`jz-jahr ${kompakt ? 'jz-kompakt' : ''}`}>
      <div className="jz-jahr-balken" role="img" aria-label={label}>
        <div className="jz-svgwrap">
          <svg viewBox="0 0 365 10" preserveAspectRatio="none" aria-hidden="true">
            <rect x="0" y="0" width={JAGDJAHR_TAGE} height="10" className="jz-r-schon" />
            {segmente.map((s, i) => (
              <rect key={i} x={s.von} y="0" width={s.bis - s.von + 1} height="10" className={s.eingeschraenkt ? 'jz-r-einschr' : 'jz-r-jagd'} />
            ))}
          </svg>
        </div>
        <span className="jz-strich" style={{ left: `${((pos + 0.5) / JAGDJAHR_TAGE) * 100}%` }} aria-hidden="true" />
      </div>
      {!kompakt && (
        <div className="jz-buchstaben" aria-hidden="true">
          {MONATE_SKALA.map((m, i) => (
            <span key={i} style={{ left: `${((m.start + m.laenge / 2) / JAGDJAHR_TAGE) * 100}%` }}>
              {m.buchstabe}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function JagdzeitenSheet({
  titel,
  gruppe,
  zeilen,
  stichtag,
  stichtagHeute,
  onStichtag,
  onSchliessen,
  rechtshinweis = RECHTSHINWEIS,
}: {
  titel: string;
  gruppe?: string | null;
  zeilen: Jagdzeit[];
  stichtag: Date;
  stichtagHeute: boolean;
  onStichtag: (d: Date) => void;
  onSchliessen: () => void;
  rechtshinweis?: string;
}) {
  const [versatz, setVersatz] = useState(0);
  const [datumOffen, setDatumOffen] = useState(false);
  const start = useRef<number | null>(null);
  const md = monatTag(stichtag);

  useEffect(() => {
    const taste = (e: KeyboardEvent) => e.key === 'Escape' && onSchliessen();
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [onSchliessen]);

  const ks = klassen(zeilen);
  const fussnoten: string[] = [];
  for (const z of zeilen) if (!z.eingeschraenkt && z.sonderregel && !fussnoten.includes(z.sonderregel)) fussnoten.push(z.sonderregel);
  const z0 = zeilen[0];

  const wischStart = (e: React.TouchEvent) => {
    start.current = e.touches[0]!.clientY;
  };
  const wischBewegt = (e: React.TouchEvent) => {
    if (start.current == null) return;
    setVersatz(Math.max(0, e.touches[0]!.clientY - start.current));
  };
  const wischEnde = () => {
    if (versatz > 90) onSchliessen();
    setVersatz(0);
    start.current = null;
  };

  return (
    <div className="jz-overlay" onClick={onSchliessen}>
      <div
        className="wte-sheet jz-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Jagdzeiten ${titel}`}
        style={versatz ? { transform: `translateY(${versatz}px)`, transition: 'none' } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="jz-griffzone" onTouchStart={wischStart} onTouchMove={wischBewegt} onTouchEnd={wischEnde}>
          <span className="jz-griff" />
          <div className="jz-sheet-kopf">
            <div>
              <h2>{titel}</h2>
              {gruppe && <div className="jz-gruppe">{gruppe}</div>}
            </div>
            <button type="button" className="jz-chip" onClick={() => setDatumOffen((o) => !o)} aria-expanded={datumOffen}>
              Stichtag: {stichtagHeute ? 'heute' : datumDE(iso(stichtag))}
            </button>
          </div>
        </div>
        {datumOffen && (
          <label className="jz-datum">
            <span>Stichtag</span>
            <input type="date" value={iso(stichtag)} onChange={(e) => e.target.value && onStichtag(new Date(`${e.target.value}T12:00:00`))} />
            <button type="button" className="jz-chip" onClick={() => onStichtag(new Date())}>
              Heute
            </button>
          </label>
        )}
        <ul className="jz-legende" aria-label="Legende">
          <Leg cls="jz-r-jagd">Jagdzeit</Leg>
          <Leg cls="jz-r-einschr">mit Einschränkung</Leg>
          <Leg cls="jz-r-schon">Schonzeit</Leg>
          <li>
            <span className="jz-leg-strich" /> Stichtag
          </li>
        </ul>

        {ks.map((c) => {
          const st = statusKlasse(c, md);
          const lang = zeitraumLang(c);
          const regeln: string[] = [];
          for (const z of c.zeilen) if (z.eingeschraenkt && z.sonderregel && !regeln.includes(z.sonderregel)) regeln.push(z.sonderregel);
          const name = c.name ?? titel;
          return (
            <section key={c.name ?? 'alle'} className="jz-klasse">
              <div className="jz-klasse-kopf">
                <span className={`jz-punkt jz-p-${st}`} />
                <strong>{name}</strong>
                <span className={`jz-wort jz-s-${st}`}>{STATUS_TEXT[st]}</span>
              </div>
              <div className="jz-zeitraum">{lang || 'keine Jagdzeit'}</div>
              <Jahresbalken
                segmente={zeitraeume(c)}
                stichtag={stichtag}
                label={`${name}: ${lang ? `Jagdzeit ${lang}` : 'keine Jagdzeit'}. Stichtag ${langDatum(stichtag)}: ${STATUS_TEXT[st]}`}
              />
              {regeln.map((r) => (
                <div key={r} className="jz-regel">
                  {r}
                </div>
              ))}
            </section>
          );
        })}

        {fussnoten.length > 0 && (
          <div className="jz-fuss">
            {fussnoten.map((f) => (
              <p key={f}>{f}</p>
            ))}
          </div>
        )}

        <Einklappbar variante="inline" titel="Quelle & Stand">
          <div className="jz-quelle">
            <p>
              <strong>Verordnung:</strong> {z0?.quelle ?? '–'}
            </p>
            <p>
              <strong>Stand:</strong> {z0?.gueltig_ab ? datumDE(z0.gueltig_ab) : '–'}
            </p>
            {z0?.quelle_url && (
              <p>
                <a href={z0.quelle_url} target="_blank" rel="noreferrer">
                  Verordnung / Übersicht öffnen
                </a>
              </p>
            )}
            <p>{rechtshinweis}</p>
          </div>
        </Einklappbar>
      </div>
    </div>
  );
}

function Leg({ cls, children }: { cls: string; children: ReactNode }) {
  return (
    <li>
      <svg width="12" height="12" aria-hidden="true">
        <rect width="12" height="12" rx="2" className={cls} />
      </svg>{' '}
      {children}
    </li>
  );
}
