import { useMemo, useState } from 'react';
import { useWildarten, wildartName } from '../../lib/stammdaten';
import { navigieren } from '../../lib/router';
import {
  RECHTSHINWEIS,
  STATUS_TEXT,
  klassen,
  monatsbalken,
  statusAm,
  useJagdzeiten,
  zeitraumText,
  type Status,
} from '../../lib/jagdzeiten';
import { datumDE } from '../../lib/zeit';
import { Auswahl, Gruppe, Hinweis, Leer, Seite, Zeile } from '../../components/ui';
import type { RevierKontext } from './kontext';

const MONATE = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONATSNAMEN = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

function Balken({ zeilen, heute }: { zeilen: ReturnType<typeof useJagdzeiten>['zeilen'] & object; heute: Date }) {
  const b = useMemo(() => monatsbalken(zeilen), [zeilen]);
  return (
    <div className="jz-balken" role="img" aria-label={b.map((s, i) => `${MONATSNAMEN[i]}: ${s === 'voll' ? 'jagdbar' : s === 'teil' ? 'teilweise jagdbar' : 'Schonzeit'}`).join(', ')}>
      {b.map((s, i) => (
        <span key={i} className={`jz-monat jz-${s} ${i === heute.getMonth() ? 'jz-heute' : ''}`}>
          {MONATE[i]}
        </span>
      ))}
    </div>
  );
}

export function Jagdzeiten({ k, unterpfad }: { k: RevierKontext; unterpfad: string[] }) {
  const wildarten = useWildarten();
  const { zeilen, geladen, fehler } = useJagdzeiten(k.bundesland);
  const [wildartFilter, setWildartFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | Status>('');
  const [nurJagdbar, setNurJagdbar] = useState(false);
  const heute = useMemo(() => new Date(), []);

  const proArt = useMemo(() => {
    const m = new Map<string, NonNullable<typeof zeilen>>();
    for (const z of zeilen ?? []) m.set(z.wildart_id, [...(m.get(z.wildart_id) ?? []), z]);
    return m;
  }, [zeilen]);

  const liste = useMemo(
    () =>
      wildarten
        .filter((w) => proArt.has(w.id))
        .map((w) => ({ w, zeilen: proArt.get(w.id)!, s: statusAm(proArt.get(w.id)!, heute) }))
        .filter((x) => (!wildartFilter || x.w.id === wildartFilter) && (!statusFilter || x.s.status === statusFilter) && (!nurJagdbar || x.s.status !== 'schonzeit')),
    [wildarten, proArt, heute, wildartFilter, statusFilter, nurJagdbar],
  );

  const kopf = (
    <>
      <Hinweis>
        {RECHTSHINWEIS} Bundesland: <strong>{k.bundesland}</strong>
        {k.istInhaber ? ' (änderbar unter Reviermanagement → Revier).' : '.'}
      </Hinweis>
      {fehler && !geladen && <Hinweis art="fehler">Jagdzeiten konnten nicht geladen werden: {fehler}</Hinweis>}
    </>
  );

  // ----- Detail einer Wildart -----
  const detailId = unterpfad[0];
  if (detailId) {
    const z = proArt.get(detailId) ?? [];
    const s = z.length ? statusAm(z, heute) : null;
    const ks = klassen(z);
    const stand = z[0]?.gueltig_ab;
    return (
      <Seite titel={wildartName(wildarten, detailId)} untertitel={s ? `Heute: ${STATUS_TEXT[s.status]}` : undefined} zurueck={() => navigieren('/jagdzeiten')}>
        {kopf}
        {!z.length ? (
          <Leer>Für diese Wildart sind für {k.bundesland} keine Zeiten hinterlegt.</Leer>
        ) : (
          <>
            <Gruppe titel="Jahresübersicht" fuss="Grün: ganzer Monat jagdbar · hell: zeitweise bzw. nur einzelne Klassen · grau: Schonzeit. Heutiger Monat umrandet.">
              <Balken zeilen={z} heute={heute} />
            </Gruppe>
            {ks.map((c) => {
              const jetzt = statusAm(c.zeilen, heute).status === 'jagdbar';
              return (
                <Gruppe key={c.name ?? 'alle'} titel={c.name ?? 'Alle Klassen'}>
                  <Zeile label="Jagdzeit" wert={c.zeilen.map(zeitraumText).join(' und ')} />
                  <Zeile label="Schonzeit" wert={c.schonzeit ?? '–'} />
                  <Zeile label="Heute" wert={jetzt ? 'jagdbar' : 'Schonzeit'} />
                  {c.sonderregel && <Zeile label="Sonderregel" wert={c.sonderregel} />}
                </Gruppe>
              );
            })}
            <Gruppe titel="Quelle" fuss="Verbindlich bleibt die Landesverordnung.">
              <Zeile label="Verordnung" wert={z[0]!.quelle} />
              <Zeile label="Stand" wert={stand ? datumDE(stand) : '–'} />
              {z[0]!.quelle_url && (
                <Zeile
                  label="Link"
                  wert={
                    <a href={z[0]!.quelle_url} target="_blank" rel="noreferrer">
                      Verordnung / Übersicht öffnen
                    </a>
                  }
                />
              )}
            </Gruppe>
          </>
        )}
      </Seite>
    );
  }

  // ----- Übersicht -----
  return (
    <Seite titel="Jagd- & Schonzeiten" untertitel={`${k.bundesland} · heute ${datumDE(heute.toISOString().slice(0, 10))}`}>
      {kopf}
      {geladen && zeilen!.length === 0 ? (
        <Hinweis>Daten für dieses Bundesland noch nicht hinterlegt.</Hinweis>
      ) : (
        <>
          <Gruppe titel="Filter">
            <Auswahl label="Wildart" value={wildartFilter} onChange={(e) => setWildartFilter(e.target.value)}>
              <option value="">Alle</option>
              {wildarten.filter((w) => proArt.has(w.id)).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Auswahl>
            <Auswahl label="Status heute" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as '' | Status)}>
              <option value="">Alle</option>
              <option value="jagdbar">jagdbar</option>
              <option value="teilweise">Sonderregel</option>
              <option value="schonzeit">Schonzeit</option>
            </Auswahl>
            <label className="zeile">
              <span className="zeile-label">Nur jagdbare Arten (auch teilweise)</span>
              <input type="checkbox" checked={nurJagdbar} onChange={(e) => setNurJagdbar(e.target.checked)} />
            </label>
          </Gruppe>
          {!geladen && <Leer>Jagdzeiten werden geladen …</Leer>}
          {geladen && liste.length === 0 && <Leer>Keine Wildart entspricht dem Filter.</Leer>}
          <div className="jz-liste">
            {liste.map(({ w, zeilen: z, s }) => (
              <button key={w.id} type="button" className="jz-karte" onClick={() => navigieren(`/jagdzeiten/${w.id}`)}>
                <span className="jz-kopf">
                  <strong>{w.name}</strong>
                  <span className={`jz-status jz-s-${s.status}`}>{STATUS_TEXT[s.status]}</span>
                </span>
                <Balken zeilen={z} heute={heute} />
                {s.status === 'teilweise' && <small>Jagdbar: {s.jagdbar.join(', ')}</small>}
              </button>
            ))}
          </div>
        </>
      )}
    </Seite>
  );
}
