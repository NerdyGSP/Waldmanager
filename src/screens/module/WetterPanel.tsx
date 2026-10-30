import { useCallback, useEffect, useState } from 'react';
import { himmelsrichtung } from '../../lib/geo';
import { sonneMond, wetterDetail, type WetterDetail } from '../../lib/wetterPanel';
import { Segmente } from '../../components/ui';

const zeitFmt = (d: Date | null) => (d ? d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '–');

// Panel zur Wetter-Chip-Anzeige: Wetter (Open-Meteo) und Sonne & Mond (lokal berechnet)
export function WetterPanel({
  lat,
  lon,
  mitte,
  onSchliessen,
}: {
  lat: number;
  lon: number;
  mitte: [number, number] | null; // Revier-Mitte (lon, lat) oder null ohne Reviergrenze
  onSchliessen: () => void;
}) {
  const [reiter, setReiter] = useState<'wetter' | 'sonne'>('wetter');
  const [w, setW] = useState<WetterDetail | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [tag, setTag] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const laden = useCallback(
    async (erzwingen: boolean) => {
      setLaedt(true);
      setW(await wetterDetail(lat, lon, erzwingen));
      setLaedt(false);
    },
    [lat, lon],
  );
  useEffect(() => {
    void laden(false);
  }, [laden]);

  const heute = new Date().toISOString().slice(0, 10);
  const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const stunden = (w?.stunden ?? []).filter((s) => {
    const t = s.zeit.slice(0, 10);
    // heute: ab der aktuellen Stunde, morgen: ganzer Tag in 3-Stunden-Schritten
    return t === heute ? new Date(s.zeit).getTime() >= Date.now() - 3600000 : t === morgen && Number(s.zeit.slice(11, 13)) % 3 === 0;
  });
  const sm = mitte ? sonneMond(mitte[1], mitte[0], new Date(`${tag}T12:00:00`)) : null;

  return (
    <div className="wetter-panel" role="dialog" aria-label="Wetter, Sonne und Mond">
      <div className="wetter-kopf">
        <Segmente label="Ansicht" wert={reiter} onAendern={setReiter} optionen={[{ wert: 'wetter', label: 'Wetter' }, { wert: 'sonne', label: 'Sonne & Mond' }]} />
        <button type="button" className="link" onClick={onSchliessen} aria-label="Schließen">
          ✕
        </button>
      </div>

      {reiter === 'wetter' && (
        <>
          {!w && <p className="leer">{laedt ? 'Wetter wird geladen …' : 'Wetter nicht verfügbar (offline?).'}</p>}
          {w && (
            <>
              <dl className="wetter-werte">
                <div><dt>Temperatur</dt><dd>{Math.round(w.temperatur)} °C <small>gefühlt {Math.round(w.gefuehlt)} °C</small></dd></div>
                <div><dt>Wind</dt><dd>{Math.round(w.windKmh)} km/h aus {himmelsrichtung(w.windRichtung)} <small>Böen {Math.round(w.boeen)}</small></dd></div>
                <div><dt>Niederschlag</dt><dd>{w.niederschlag.toLocaleString('de-DE')} mm</dd></div>
                <div><dt>Bewölkung</dt><dd>{w.bewoelkung} %</dd></div>
              </dl>
              <div className="wetter-stunden" role="table" aria-label="Stundenprognose">
                <div role="row" className="kopf">
                  <span>Zeit</span><span>°C</span><span>Wind / Böen</span><span>mm</span><span>Wolken</span>
                </div>
                {stunden.map((s) => (
                  <div role="row" key={s.zeit}>
                    <span>{s.zeit.slice(0, 10) === heute ? '' : 'morgen '}{s.zeit.slice(11, 16)}</span>
                    <span>{Math.round(s.temperatur)}</span>
                    <span>{Math.round(s.windKmh)} / {Math.round(s.boeen)}</span>
                    <span>{s.niederschlag.toLocaleString('de-DE')}</span>
                    <span>{s.bewoelkung} %</span>
                  </div>
                ))}
              </div>
              <small className="leer">Open-Meteo · Stand {new Date(w.stand).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</small>
              <button type="button" className="link" onClick={() => void laden(true)}>↻ Aktualisieren</button>
            </>
          )}
        </>
      )}

      {reiter === 'sonne' && (
        <>
          <label className="zeile feld">
            <span className="zeile-label">Datum</span>
            <input type="date" value={tag} onChange={(e) => e.target.value && setTag(e.target.value)} />
          </label>
          {!sm && <p className="leer">Bitte Revier-Grenze anlegen – Sonne und Mond werden für die Reviermitte berechnet.</p>}
          {sm && (
            <dl className="wetter-werte">
              <div><dt>Bürgerl. Dämmerung (Morgen)</dt><dd>{zeitFmt(sm.daemmerungAnfang)}</dd></div>
              <div><dt>Sonnenaufgang</dt><dd>{zeitFmt(sm.aufgang)}</dd></div>
              <div><dt>Sonnenuntergang</dt><dd>{zeitFmt(sm.untergang)}</dd></div>
              <div><dt>Bürgerl. Dämmerung (Abend)</dt><dd>{zeitFmt(sm.daemmerungEnde)}</dd></div>
              <div><dt>Mondaufgang</dt><dd>{zeitFmt(sm.mondAufgang)}</dd></div>
              <div><dt>Monduntergang</dt><dd>{zeitFmt(sm.mondUntergang)}</dd></div>
              <div><dt>Mondphase</dt><dd>{sm.mondphase} <small>{sm.beleuchtung} % beleuchtet</small></dd></div>
            </dl>
          )}
          <small className="leer">Lokal berechnet für die Reviermitte (Zeiten in deiner Ortszeit).</small>
        </>
      )}
    </div>
  );
}
