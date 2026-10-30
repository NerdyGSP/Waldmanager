import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ereignisOeffnen, symbolFuer, useEreignisse, type Ereignis } from '../lib/ereignisse';

function tagesSchluessel(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function gruppieren(liste: Ereignis[]) {
  const heute = new Date();
  const gestern = new Date(heute.getTime() - 86400000);
  const gruppen: Array<{ titel: string; eintraege: Ereignis[] }> = [
    { titel: 'Heute', eintraege: [] },
    { titel: 'Gestern', eintraege: [] },
    { titel: 'Älter', eintraege: [] },
  ];
  for (const e of liste) {
    const k = tagesSchluessel(new Date(e.erstellt_am));
    (k === tagesSchluessel(heute) ? gruppen[0] : k === tagesSchluessel(gestern) ? gruppen[1] : gruppen[2]).eintraege.push(e);
  }
  return gruppen.filter((g) => g.eintraege.length > 0);
}

function zeitText(e: Ereignis, mitDatum: boolean) {
  const d = new Date(e.erstellt_am);
  const uhr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return mitDatum ? `${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} ${uhr}` : uhr;
}

export function Glocke({ revierId, userId, className = '' }: { revierId: string | null; userId: string; className?: string }) {
  const { liste, ungelesen, gelesenBis, ladeFehler, markieren } = useEreignisse(revierId, userId);
  const [offen, setOffen] = useState(false);
  const knopf = useRef<HTMLButtonElement>(null);
  const [lage, setLage] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!offen) return;
    const r = knopf.current?.getBoundingClientRect();
    if (r) setLage({ top: r.bottom + 8, left: Math.max(8, Math.min(r.left, window.innerWidth - 368)) });
    const taste = (ev: KeyboardEvent) => ev.key === 'Escape' && setOffen(false);
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [offen]);

  if (!revierId) return null;
  const badge = ungelesen > 9 ? '9+' : String(ungelesen);

  async function antippen(e: Ereignis) {
    setOffen(false);
    void markieren(e.erstellt_am);
    await ereignisOeffnen(e, revierId!);
  }

  return (
    <>
      <button
        ref={knopf}
        type="button"
        className={`glocke ${offen ? 'aktiv' : ''} ${className}`}
        onClick={() => setOffen((o) => !o)}
        aria-label={ungelesen > 0 ? `Benachrichtigungen, ${ungelesen} ungelesen` : 'Benachrichtigungen'}
        aria-expanded={offen}
        title="Benachrichtigungen"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9a6 6 0 1112 0c0 5 2 6.5 2 6.5H4S6 14 6 9z" />
          <path d="M10 19a2 2 0 004 0" />
        </svg>
        {ungelesen > 0 && <span className="glocke-badge">{badge}</span>}
      </button>
      {offen &&
        createPortal(
          <>
            <div className="glocke-schleier" onClick={() => setOffen(false)} />
            <div className="glocke-panel" role="dialog" aria-label="Benachrichtigungen" style={lage ? { top: lage.top, left: lage.left } : undefined}>
              <header>
                <strong>Benachrichtigungen</strong>
                <button type="button" className="glocke-alle" disabled={ungelesen === 0} onClick={() => void markieren()}>
                  Alle als gelesen
                </button>
              </header>
              <div className="glocke-liste">
                {ladeFehler && <p className="glocke-leer">Benachrichtigungen konnten nicht geladen werden.</p>}
                {!ladeFehler && liste.length === 0 && <p className="glocke-leer">Keine Neuigkeiten.</p>}
                {gruppieren(liste).map((g) => (
                  <section key={g.titel}>
                    <h3>{g.titel}</h3>
                    {g.eintraege.map((e) => {
                      const neu = !gelesenBis || e.erstellt_am > gelesenBis;
                      return (
                        <button key={e.id} type="button" className={`glocke-zeile ${neu ? 'neu' : ''} ${e.hervorgehoben ? 'hervor' : ''}`} onClick={() => void antippen(e)}>
                          <span className="glocke-symbol" aria-hidden="true">{symbolFuer(e)}</span>
                          <span className="glocke-text">
                            <strong>{e.titel}</strong>
                            <small>
                              {e.akteur_name ?? 'Unbekannt'} · {zeitText(e, g.titel === 'Älter')}
                            </small>
                          </span>
                          {neu && <span className="glocke-punkt" aria-label="ungelesen" />}
                        </button>
                      );
                    })}
                  </section>
                ))}
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
