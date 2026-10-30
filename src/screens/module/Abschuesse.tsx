import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { GESCHLECHTER, useMitglieder, useWildarten, useZonen, wildartName } from '../../lib/stammdaten';
import { aktuellesJagdjahr, datumZeitDE, letzteJagdjahre, lokalDatumZeit } from '../../lib/zeit';
import { aktuellePosition, punktEWKT } from '../../lib/geo';
import { PositionWaehlen } from '../../components/PositionWaehlen';
import type { Enums } from '../../lib/database.types';
import { jagdzeitWarnung, useJagdzeiten } from '../../lib/jagdzeiten';
import { Auswahl, Feld, Gruppe, Hinweis, Knopf, Leer, Seite, Segmente, Zeile, WildartOptionen } from '../../components/ui';
import type { RevierKontext } from './kontext';
import { Symbol } from '../../components/symbole';

// Fangfähige Arten (Fang melden)
const FANG_WILDARTEN = ['fuchs', 'waschbaer', 'dachs', 'marderhund', 'steinmarder', 'baummarder', 'iltis', 'hermelin', 'mink', 'nutria'];

type Abschuss = {
  id: string;
  erlegt_am: string;
  wildart_id: string | null;
  geschlecht: Enums<'geschlecht'>;
  altersklasse: string | null;
  gewicht_kg: number | null;
  zone_id: string | null;
  erleger_id: string | null;
  erfasst_von: string | null;
  bemerkung: string | null;
  art: string;
  einrichtung_id: string | null;
  fang_ergebnis: string | null;
  fang_zustand: string | null;
};

export function Abschuesse({ k, unterpfad = [] }: { k: RevierKontext; unterpfad?: string[] }) {
  const wildarten = useWildarten();
  const { zonen } = useZonen(k.revierId);
  const mitglieder = useMitglieder(k.revierId);
  const [jahr, setJahr] = useState(aktuellesJagdjahr());
  const [liste, setListe] = useState<Abschuss[]>([]);
  const [bearbeiten, setBearbeiten] = useState<Abschuss | 'neu' | null>(unterpfad[0] === 'fang' ? 'neu' : null);
  const startArt = unterpfad[0] === 'fang' ? 'fang' : 'abschuss';
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const { data, error } = await supabase
      .from('abschuesse')
      .select('id, erlegt_am, wildart_id, geschlecht, altersklasse, gewicht_kg, zone_id, erleger_id, erfasst_von, bemerkung, art, einrichtung_id, fang_ergebnis, fang_zustand')
      .eq('revier_id', k.revierId)
      .is('geloescht_am', null)
      .gte('erlegt_am', `${jahr.von}T00:00:00`)
      .lte('erlegt_am', `${jahr.bis}T23:59:59`)
      .order('erlegt_am', { ascending: false });
    if (error) setFehler(fehlertext(error));
    setListe(data ?? []);
  }, [k.revierId, jahr]);

  useEffect(() => {
    void laden();
  }, [laden]);

  // Strecke = Abschüsse + tatsächlich gefangene Tiere
  const zaehltZurStrecke = (x: { art: string; fang_ergebnis: string | null }) => x.art === 'abschuss' || (x.art === 'fang' && x.fang_ergebnis === 'gefangen');
  const strecke = useMemo(() => {
    const m = new Map<string, { gesamt: number; m: number; w: number }>();
    for (const a of liste.filter((x) => zaehltZurStrecke(x) && x.wildart_id)) {
      const s = m.get(a.wildart_id!) ?? { gesamt: 0, m: 0, w: 0 };
      s.gesamt++;
      if (a.geschlecht === 'maennlich') s.m++;
      if (a.geschlecht === 'weiblich') s.w++;
      m.set(a.wildart_id!, s);
    }
    return [...m.entries()].sort((a, b) => b[1].gesamt - a[1].gesamt);
  }, [liste]);

  const name = (id: string | null) => mitglieder.find((m) => m.user_id === id)?.name ?? '–';
  const zone = (id: string | null) => zonen.find((z) => z.id === id)?.name;

  if (bearbeiten) {
    return (
      <AbschussFormular
        k={k}
        vorlage={bearbeiten === 'neu' ? null : bearbeiten}
        startArt={startArt}
        onFertig={async () => {
          setBearbeiten(null);
          await laden();
        }}
      />
    );
  }

  return (
    <Seite
      titel="Abschüsse & Fänge"
      untertitel={`Jagdjahr ${jahr.label} · ${liste.filter(zaehltZurStrecke).length} Stück Strecke${liste.some((x) => x.art === 'fang') ? ` · ${liste.filter((x) => x.art === 'fang').length} Fangmeldungen` : ''}`}
      aktion={<Knopf onClick={() => setBearbeiten('neu')}>+ Erfassen</Knopf>}
    >
      <label className="filter">
        <span>Jagdjahr</span>
        <select value={jahr.start} onChange={(e) => setJahr(letzteJagdjahre().find((j) => j.start === Number(e.target.value)) ?? jahr)}>
          {letzteJagdjahre().map((j) => (
            <option key={j.start} value={j.start}>
              {j.label}
            </option>
          ))}
        </select>
      </label>

      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}

      {strecke.length > 0 && (
        <Gruppe titel="Strecke">
          {strecke.map(([id, s]) => (
            <Zeile key={id} label={wildartName(wildarten, id)} wert={`${s.gesamt} (♂ ${s.m} · ♀ ${s.w})`} />
          ))}
        </Gruppe>
      )}

      <Gruppe titel="Einzeleinträge">
        {liste.length === 0 && <Zeile label="Keine Einträge in diesem Jagdjahr" />}
        {liste.map((a) => (
          <button key={a.id} className="zeile zeile-knopf" onClick={() => setBearbeiten(a)}>
            <span className="zeile-label">
              {a.art === 'fang' ? `Fang · ${a.fang_ergebnis === 'leer' ? 'leer' : `${a.wildart_id ? wildartName(wildarten, a.wildart_id) : ''}${a.fang_ergebnis === 'fehlfang' ? ' (Fehlfang)' : a.fang_zustand ? ` (${a.fang_zustand})` : ''}`}` : `${wildartName(wildarten, a.wildart_id ?? '')} ${GESCHLECHTER.find((g) => g.wert === a.geschlecht)?.kurz}`}
              {a.altersklasse ? ` · ${a.altersklasse}` : ''}
              <small>
                {datumZeitDE(a.erlegt_am)} · {name(a.erleger_id)}
                {zone(a.zone_id) ? ` · ${zone(a.zone_id)}` : ''}
                {a.gewicht_kg ? ` · ${a.gewicht_kg.toLocaleString('de-DE')} kg` : ''}
              </small>
            </span>
            <span className="zeile-pfeil" aria-hidden="true">
              ›
            </span>
          </button>
        ))}
      </Gruppe>
    </Seite>
  );
}

function AbschussFormular({ k, vorlage, startArt, onFertig }: { k: RevierKontext; vorlage: Abschuss | null; startArt: string; onFertig: () => Promise<void> }) {
  const wildarten = useWildarten();
  const { zonen } = useZonen(k.revierId);
  const mitglieder = useMitglieder(k.revierId);
  const [art, setArt] = useState(vorlage?.art ?? startArt);
  const [falleId, setFalleId] = useState(vorlage?.einrichtung_id ?? '');
  const [ergebnis, setErgebnis] = useState<'gefangen' | 'leer' | 'fehlfang'>((vorlage?.fang_ergebnis as 'gefangen' | 'leer' | 'fehlfang' | null) ?? 'gefangen');
  const [zustand, setZustand] = useState<'lebend' | 'tot'>((vorlage?.fang_zustand as 'lebend' | 'tot' | null) ?? 'tot');
  const [fallen, setFallen] = useState<Array<{ id: string; name: string | null }>>([]);
  useEffect(() => {
    void supabase.from('einrichtungen').select('id, name').eq('revier_id', k.revierId).eq('typ', 'falle').is('geloescht_am', null).order('name').then(({ data }) => setFallen(data ?? []));
  }, [k.revierId]);
  const [wildartId, setWildartId] = useState(vorlage?.wildart_id ?? ((vorlage?.art ?? startArt) === 'fang' ? FANG_WILDARTEN[0] : 'rehwild'));
  useEffect(() => {
    if (art === 'fang' && !FANG_WILDARTEN.includes(wildartId)) setWildartId(FANG_WILDARTEN[0]);
  }, [art, wildartId]);
  const [geschlecht, setGeschlecht] = useState<Enums<'geschlecht'>>(vorlage?.geschlecht ?? 'unbekannt');
  const [altersklasse, setAltersklasse] = useState(vorlage?.altersklasse ?? '');
  const [zeitpunkt, setZeitpunkt] = useState(vorlage ? lokalDatumZeit(new Date(vorlage.erlegt_am)) : lokalDatumZeit());
  // Nur Hinweis, keine Sperre: Wildart und Datum gegen die hinterlegten Jagdzeiten halten
  const { zeilen: jagdzeiten } = useJagdzeiten(k.bundesland);
  const jzWarnung =
    art === 'fang' && ergebnis === 'leer' ? null : jagdzeitWarnung(jagdzeiten, wildartId, new Date(zeitpunkt.length >= 10 ? zeitpunkt : Date.now()));
  const [gewicht, setGewicht] = useState(vorlage?.gewicht_kg ? String(vorlage.gewicht_kg).replace('.', ',') : '');
  const [zoneId, setZoneId] = useState(vorlage?.zone_id ?? '');
  const [erlegerId, setErlegerId] = useState(vorlage?.erleger_id ?? k.userId);
  const [bemerkung, setBemerkung] = useState(vorlage?.bemerkung ?? '');
  const [position, setPosition] = useState<{ lon: number; lat: number } | null>(null);
  const [ortStatus, setOrtStatus] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [speichert, setSpeichert] = useState(false);

  const klassen = wildarten.find((w) => w.id === wildartId)?.altersklassen ?? [];
  const darfLoeschen = vorlage && (k.istInhaber || vorlage.erfasst_von === k.userId);

  async function ortUebernehmen() {
    setOrtStatus('Position wird bestimmt …');
    const p = await aktuellePosition();
    if (!p) {
      setOrtStatus('Position nicht verfügbar – bitte Ortungsfreigabe prüfen.');
      return;
    }
    setPosition({ lon: p.lon, lat: p.lat });
    const { data } = await supabase.rpc('zone_an_position', { p_revier_id: k.revierId, p_lon: p.lon, p_lat: p.lat });
    if (data) setZoneId(data);
    setOrtStatus(`Position übernommen (± ${p.genauigkeit} m)${data ? ', Zone automatisch gesetzt' : ''}`);
  }

  async function speichern(e: FormEvent) {
    e.preventDefault();
    setFehler(null);
    const kg = gewicht.trim() ? Number(gewicht.replace(',', '.')) : null;
    if (kg !== null && (!Number.isFinite(kg) || kg <= 0)) {
      setFehler('Bitte ein gültiges Gewicht angeben.');
      return;
    }
    if (art === 'fang' && !falleId) {
      setFehler('Bitte die Falle auswählen.');
      return;
    }
    setSpeichert(true);
    const fang = art === 'fang';
    const daten = {
      revier_id: k.revierId,
      art,
      wildart_id: fang && ergebnis === 'leer' ? null : wildartId,
      geschlecht: fang ? ('unbekannt' as const) : geschlecht,
      altersklasse: fang ? null : altersklasse || null,
      erlegt_am: new Date(zeitpunkt).toISOString(),
      gewicht_kg: fang ? null : kg,
      zone_id: zoneId || null,
      erleger_id: fang ? k.userId : erlegerId || null,
      einrichtung_id: fang ? falleId : null,
      fang_ergebnis: fang ? ergebnis : null,
      fang_zustand: fang && ergebnis === 'gefangen' ? zustand : null,
      bemerkung: bemerkung.trim() || null,
      ...(position ? { geom: punktEWKT(position.lon, position.lat) } : {}),
    };
    const { error } = vorlage
      ? await supabase.from('abschuesse').update(daten).eq('id', vorlage.id)
      : await supabase.from('abschuesse').insert(daten);
    setSpeichert(false);
    if (error) setFehler(fehlertext(error));
    else await onFertig();
  }

  async function loeschen() {
    if (!vorlage || !window.confirm('Diesen Abschuss löschen?')) return;
    const { error } = await supabase.from('abschuesse').delete().eq('id', vorlage.id);
    if (error) setFehler(fehlertext(error));
    else await onFertig();
  }

  return (
    <Seite titel={`${art === 'fang' ? 'Fang' : 'Abschuss'} ${vorlage ? 'bearbeiten' : 'erfassen'}`} zurueck={() => void onFertig()}>
      <form onSubmit={speichern}>
        <Segmente label="Art" wert={art} onAendern={setArt} optionen={[{ wert: 'abschuss', label: 'Abschuss' }, { wert: 'fang', label: 'Fang' }]} />
        {art === 'fang' ? (
          <Gruppe>
            <Auswahl label="Falle" required value={falleId} onChange={(e) => setFalleId(e.target.value)}>
              <option value="">– bitte wählen –</option>
              {fallen.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name ?? 'Falle ohne Namen'}
                </option>
              ))}
            </Auswahl>
            {fallen.length === 0 && <Leer>Noch keine Einrichtung vom Typ „Falle“ angelegt (Karte → WTE → Einrichtung anlegen).</Leer>}
            <div className="zeile">
              <span className="zeile-label">Ergebnis</span>
              <Segmente
                label="Ergebnis"
                wert={ergebnis}
                onAendern={setErgebnis}
                optionen={[{ wert: 'gefangen', label: 'Gefangen' }, { wert: 'leer', label: 'Leer' }, { wert: 'fehlfang', label: 'Fehlfang' }]}
              />
            </div>
            {ergebnis !== 'leer' && (
              <Auswahl label="Wildart" value={wildartId} onChange={(e) => setWildartId(e.target.value)}>
                {FANG_WILDARTEN.map((id) => (
                  <option key={id} value={id}>
                    {wildartName(wildarten, id)}
                  </option>
                ))}
              </Auswahl>
            )}
            {ergebnis === 'gefangen' && (
              <div className="zeile">
                <span className="zeile-label">Zustand</span>
                <Segmente label="Zustand" wert={zustand} onAendern={setZustand} optionen={[{ wert: 'lebend', label: 'Lebend' }, { wert: 'tot', label: 'Tot' }]} />
              </div>
            )}
            <Feld label="Kontrolle am" type="datetime-local" required value={zeitpunkt} onChange={(e) => setZeitpunkt(e.target.value)} />
          </Gruppe>
        ) : (
        <Gruppe>
          <Auswahl
            label="Wildart"
            value={wildartId}
            onChange={(e) => {
              setWildartId(e.target.value);
              setAltersklasse('');
            }}
          >
            <WildartOptionen wildarten={wildarten} />
          </Auswahl>
          <div className="zeile">
            <span className="zeile-label">Geschlecht</span>
            <Segmente
              label="Geschlecht"
              wert={geschlecht}
              onAendern={setGeschlecht}
              optionen={GESCHLECHTER.map((g) => ({ wert: g.wert, label: g.label }))}
            />
          </div>
          {klassen.length > 0 ? (
            <Auswahl label="Altersklasse" value={altersklasse} onChange={(e) => setAltersklasse(e.target.value)}>
              <option value="">–</option>
              {klassen.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Auswahl>
          ) : (
            <Feld label="Altersklasse" placeholder="optional" value={altersklasse} onChange={(e) => setAltersklasse(e.target.value)} />
          )}
          <Feld label="Erlegt am" type="datetime-local" required value={zeitpunkt} onChange={(e) => setZeitpunkt(e.target.value)} />
          <Feld label="Gewicht (kg)" inputMode="decimal" placeholder="aufgebrochen, optional" value={gewicht} onChange={(e) => setGewicht(e.target.value)} />
        </Gruppe>
        )}

        <Gruppe>
          {art !== 'fang' && (
          <Auswahl label="Erleger" value={erlegerId} onChange={(e) => setErlegerId(e.target.value)}>
            <option value="">–</option>
            {mitglieder.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name}
              </option>
            ))}
          </Auswahl>
          )}
          <Auswahl label="Zone" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">–</option>
            {zonen.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </Auswahl>
          <Feld label="Bemerkung" value={bemerkung} onChange={(e) => setBemerkung(e.target.value)} />
        </Gruppe>

        <Knopf type="button" variante="sekundaer" onClick={ortUebernehmen}>
          <Symbol name="position" className="symbol klein" /> Aktuelle Position als {art === 'fang' ? 'Fangort' : 'Erlegeort'}
        </Knopf>
        <PositionWaehlen
          revierId={k.revierId}
          wert={position}
          onWaehlen={async (p) => {
            setPosition(p);
            const { data } = await supabase.rpc('zone_an_position', { p_revier_id: k.revierId, p_lon: p.lon, p_lat: p.lat });
            if (data) setZoneId(data);
            setOrtStatus(`Erlegeort auf der Karte gewählt${data ? ', Zone automatisch gesetzt' : ''}`);
          }}
        />
        {ortStatus && <Leer>{ortStatus}</Leer>}

        {jzWarnung && <Hinweis art={jzWarnung.art === 'warnung' ? 'warnung' : 'info'}>{jzWarnung.text} (Hinweis, kein Speicherverbot – verbindlich ist die Landesverordnung.)</Hinweis>}
        {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
        <Knopf type="submit" disabled={speichert}>
          {speichert ? 'Speichern …' : 'Speichern'}
        </Knopf>
        <Knopf type="button" variante="sekundaer" onClick={() => void onFertig()}>
          Abbrechen
        </Knopf>
        {darfLoeschen && (
          <Knopf type="button" variante="gefahr" onClick={loeschen}>
            Abschuss löschen
          </Knopf>
        )}
      </form>
    </Seite>
  );
}
