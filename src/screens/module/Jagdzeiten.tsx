import { useCallback, useMemo, useState } from 'react';
import { useWildarten } from '../../lib/stammdaten';
import { navigieren } from '../../lib/router';
import {
  RECHTSHINWEIS,
  STATUS_TEXT,
  klassen,
  statusAm,
  tagesverlauf,
  useJagdzeiten,
  type Status,
  type Zeitraum,
} from '../../lib/jagdzeiten';
import { datumDE } from '../../lib/zeit';
import { Auswahl, Einklappbar, Hinweis, Leer, Seite } from '../../components/ui';
import { Jahresbalken, JagdzeitenSheet } from './JagdzeitenSheet';
import type { RevierKontext } from './kontext';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function stichtagAusUrl(): Date {
  const p = new URLSearchParams(window.location.search).get('stichtag');
  if (p && /^\d{4}-\d{2}-\d{2}$/.test(p)) {
    const d = new Date(`${p}T12:00:00`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

/** Aggregierte Tagesfolge → zusammenhängende Zeiträume (2 = grün, 1 = orange) */
function laeufe(v: number[]): Zeitraum[] {
  const out: Zeitraum[] = [];
  let i = 0;
  while (i < v.length) {
    if (v[i] === 0) { i++; continue; }
    let j = i;
    while (j + 1 < v.length && v[j + 1] === v[i]) j++;
    out.push({ von: i, bis: j, eingeschraenkt: v[i] === 1 });
    i = j + 1;
  }
  return out;
}

export function Jagdzeiten({ k, unterpfad }: { k: RevierKontext; unterpfad: string[] }) {
  const wildarten = useWildarten();
  const { zeilen, geladen, fehler } = useJagdzeiten(k.bundesland);
  const [wildartFilter, setWildartFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | Status>('');
  const [nurJagdbar, setNurJagdbar] = useState(false);
  const [stichtag, setStichtagState] = useState<Date>(stichtagAusUrl);
  const heuteIso = iso(new Date());
  const stichtagHeute = iso(stichtag) === heuteIso;
  const suche = stichtagHeute ? '' : `?stichtag=${iso(stichtag)}`;

  const setStichtag = useCallback((d: Date) => {
    setStichtagState(d);
    const t = iso(d) === iso(new Date()) ? '' : `?stichtag=${iso(d)}`;
    window.history.replaceState(null, '', window.location.pathname + t);
  }, []);

  const proArt = useMemo(() => {
    const m = new Map<string, NonNullable<typeof zeilen>>();
    for (const z of zeilen ?? []) m.set(z.wildart_id, [...(m.get(z.wildart_id) ?? []), z]);
    return m;
  }, [zeilen]);

  const liste = useMemo(
    () =>
      wildarten
        .filter((w) => proArt.has(w.id))
        .map((w) => ({ w, zeilen: proArt.get(w.id)!, s: statusAm(proArt.get(w.id)!, stichtag) }))
        .filter((x) => (!wildartFilter || x.w.id === wildartFilter) && (!statusFilter || x.s.status === statusFilter) && (!nurJagdbar || x.s.status !== 'schonzeit')),
    [wildarten, proArt, stichtag, wildartFilter, statusFilter, nurJagdbar],
  );

  const detailId = unterpfad[0];
  const detailW = detailId ? wildarten.find((w) => w.id === detailId) : undefined;
  const detailZ = detailId ? proArt.get(detailId) ?? [] : [];
  const schliessen = useCallback(() => navigieren('/jagdzeiten' + suche), [suche]);

  return (
    <Seite titel="Jagd- & Schonzeiten" untertitel={`${k.bundesland} · Stichtag ${stichtagHeute ? 'heute ' : ''}${datumDE(iso(stichtag))}`}>
      <Hinweis>
        {RECHTSHINWEIS} Bundesland: <strong>{k.bundesland}</strong>
        {k.istInhaber ? ' (änderbar unter Reviermanagement → Revier).' : '.'}
      </Hinweis>
      {fehler && !geladen && <Hinweis art="fehler">Jagdzeiten konnten nicht geladen werden: {fehler}</Hinweis>}
      {geladen && zeilen!.length === 0 ? (
        <Hinweis>Daten für dieses Bundesland noch nicht hinterlegt.</Hinweis>
      ) : (
        <>
          <Einklappbar variante="karte" titel="Filter" speicher="jagdzeiten.filter">
            <Auswahl label="Wildart" value={wildartFilter} onChange={(e) => setWildartFilter(e.target.value)}>
              <option value="">Alle</option>
              {wildarten.filter((w) => proArt.has(w.id)).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Auswahl>
            <label className="zeile">
              <span className="zeile-label">Stichtag</span>
              <input type="date" value={iso(stichtag)} onChange={(e) => e.target.value && setStichtag(new Date(`${e.target.value}T12:00:00`))} />
            </label>
            <Auswahl label="Status am Stichtag" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as '' | Status)}>
              <option value="">Alle</option>
              <option value="jagdbar">jagdbar</option>
              <option value="eingeschraenkt">eingeschränkt</option>
              <option value="schonzeit">Schonzeit</option>
            </Auswahl>
            <label className="zeile">
              <span className="zeile-label">Nur jagdbare Arten (auch eingeschränkt)</span>
              <input type="checkbox" checked={nurJagdbar} onChange={(e) => setNurJagdbar(e.target.checked)} />
            </label>
          </Einklappbar>
          {!geladen && <Leer>Jagdzeiten werden geladen …</Leer>}
          {geladen && liste.length === 0 && <Leer>Keine Wildart entspricht dem Filter.</Leer>}
          <div className="jz-liste">
            {liste.map(({ w, zeilen: z, s }) => {
              const seg = laeufe(tagesverlauf(klassen(z)));
              return (
                <button key={w.id} type="button" className="jz-karte" onClick={() => navigieren(`/jagdzeiten/${w.id}${suche}`)}>
                  <span className="jz-kopf">
                    <strong>{w.name}</strong>
                    <span className={`jz-status jz-s-${s.status}`}>{STATUS_TEXT[s.status]}</span>
                  </span>
                  <Jahresbalken segmente={seg} stichtag={stichtag} kompakt label={`${w.name}: ${STATUS_TEXT[s.status]} am ${datumDE(iso(stichtag))}`} />
                  {s.status === 'eingeschraenkt' && s.jagdbar.length > 0 && <small>Jagdbar: {s.jagdbar.join(', ')}</small>}
                </button>
              );
            })}
          </div>
        </>
      )}
      {detailId && geladen && (
        <JagdzeitenSheet
          titel={detailW?.name ?? 'Wildart'}
          gruppe={detailW?.gruppe}
          zeilen={detailZ}
          stichtag={stichtag}
          stichtagHeute={stichtagHeute}
          onStichtag={setStichtag}
          onSchliessen={schliessen}
        />
      )}
    </Seite>
  );
}
