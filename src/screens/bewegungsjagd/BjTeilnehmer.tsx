import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { codeAnzeigen, navigationsLinks, type BjLadeErgebnis } from '../../lib/bewegungsjagd';
import { datumDE } from '../../lib/zeit';
import { Feld, Hinweis, Knopf, Gruppe, Segmente } from '../../components/ui';
import type { BjMarker } from './BjKarte';
import { TeilnehmerSelbstDruck } from './BjDruck';

const BjKarte = lazy(() => import('./BjKarte'));

// Öffentliche Anmeldeseite /bj/:id – Zugang nur mit Einladungscode, ohne Konto
export function BjTeilnehmer({ jagdId }: { jagdId: string }) {
  const [code, setCode] = useState(() => codeAnzeigen(new URLSearchParams(window.location.search).get('code') ?? ''));
  const [daten, setDaten] = useState<BjLadeErgebnis | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [schritt, setSchritt] = useState(0);
  const [fertig, setFertig] = useState<null | 'zusage' | 'absage'>(null);
  const [warnung, setWarnung] = useState(false);
  const [druck, setDruck] = useState(false);
  const [name, setName] = useState('');
  const [anschrift, setAnschrift] = useState('');
  const [telefon, setTelefon] = useState('');
  const [zusage, setZusage] = useState<boolean | null>(null);
  const [hund, setHund] = useState(false);
  const [horn, setHorn] = useState(false);
  const [auto, setAuto] = useState(false);
  const [plaetze, setPlaetze] = useState('0');
  const [schuessel, setSchuessel] = useState(false);

  async function laden(c = code) {
    setLaedt(true);
    setFehler(null);
    const { data, error } = await supabase.rpc('bj_laden', { p_jagd: jagdId, p_code: c });
    setLaedt(false);
    if (error) return setFehler(fehlertext(error));
    if (!data) return setFehler('Der Code ist ungültig oder abgelaufen. Bitte prüfe ihn in deiner Einladungs-E-Mail.');
    const d = data as unknown as BjLadeErgebnis;
    setDaten(d);
    setName(d.ich.name);
    setAnschrift(d.ich.anschrift ?? '');
    setTelefon(d.ich.telefon ?? '');
    setHund(!!d.ich.hat_hund);
    setHorn(!!d.ich.hat_hornblaeser);
    setAuto(!!d.ich.auto_vorhanden);
    setPlaetze(String(d.ich.mitfahrplaetze ?? 0));
    setSchuessel(!!d.ich.schuesseltreiben_teilnahme);
    if (d.ich.status === 'zugesagt') setZusage(true);
  }

  useEffect(() => {
    if (code.replace('-', '').length === 8) void laden();
    // einmalig mit dem Code aus dem Link
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const marker = useMemo<BjMarker[]>(() => {
    if (!daten) return [];
    const m: BjMarker[] = [];
    if (daten.jagd.lng != null && daten.jagd.lat != null) m.push({ id: 'tp', lng: daten.jagd.lng, lat: daten.jagd.lat, art: 'treffpunkt', label: 'Treffpunkt' });
    for (const b of daten.boecke) {
      const eigener = b.id === daten.ich.einrichtung_id;
      m.push({ id: b.id, lng: b.lng, lat: b.lat, art: eigener ? 'eigener' : 'bock', label: eigener ? `Dein Stand${b.name ? `: ${b.name}` : ''}` : (b.name ?? 'Drückjagdbock') });
    }
    for (const r of daten.rettungspunkte ?? []) m.push({ id: `r${r.id}`, lng: r.lng, lat: r.lat, art: 'rettung', label: r.name });
    return m;
  }, [daten]);

  if (fertig) {
    return (
      <main className="bj-teiln">
        <Hinweis art="erfolg">{fertig === 'zusage' ? 'Danke! Deine Zusage ist gespeichert. Du kannst sie über den Link in der E-Mail jederzeit ändern.' : 'Deine Absage ist eingegangen und deine Daten wurden gelöscht.'}</Hinweis>
        {fertig === 'zusage' && daten && (
          <>
            <Anstellinfo daten={daten} />
            <Knopf variante="akzent" onClick={() => setDruck(true)}>Zusammenfassung drucken</Knopf>
            {druck && (
              <TeilnehmerSelbstDruck
                jagd={{
                  titel: daten.jagd.titel,
                  art: daten.jagd.art,
                  datum: daten.jagd.datum,
                  uhrzeit: daten.jagd.uhrzeit,
                  lng: daten.jagd.lng,
                  lat: daten.jagd.lat,
                  schuesseltreiben: daten.jagd.schuesseltreiben,
                  schuesseltreiben_adresse: daten.jagd.schuesseltreiben_adresse,
                  anmeldung_pflicht: daten.jagd.anmeldung_pflicht,
                  hegebeitrag_aktiv: daten.jagd.hegebeitrag_aktiv,
                  hegebeitrag_betrag: daten.jagd.hegebeitrag_betrag,
                  einladungstext: daten.jagd.einladungstext,
                }}
                tn={{ name, anschrift, telefon, hund, horn, auto, plaetze: Number(plaetze) || 0, schuessel }}
                stand={daten.stand ?? undefined}
                boecke={daten.boecke}
                rettung={daten.rettungspunkte ?? []}
                leitung={daten.jagdleitung ?? []}
                ansteller={daten.ansteller ?? null}
                onZu={() => setDruck(false)}
              />
            )}
          </>
        )}
      </main>
    );
  }

  if (!daten) {
    return (
      <main className="bj-teiln">
        <h1>Einladung zur Bewegungsjagd</h1>
        <Gruppe titel="Einladungscode" fuss="Den Code findest du in deiner Einladungs-E-Mail (Format XXXX-XXXX).">
          <Feld label="Code" value={code} autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={9} onChange={(e) => setCode(codeAnzeigen(e.target.value))} />
        </Gruppe>
        {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
        <Knopf variante="akzent" disabled={laedt || code.replace('-', '').length !== 8} onClick={() => void laden()}>
          {laedt ? 'Prüfe …' : 'Weiter'}
        </Knopf>
      </main>
    );
  }

  const j = daten.jagd;
  const links = j.lat != null && j.lng != null ? navigationsLinks(j.lat, j.lng) : null;
  const betrag = j.hegebeitrag_betrag != null ? Number(j.hegebeitrag_betrag).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : '';
  const geschlossen = j.status !== 'offen';

  async function absagen() {
    setLaedt(true);
    const { data, error } = await supabase.rpc('bj_absagen_loeschen', { p_jagd: jagdId, p_code: code });
    setLaedt(false);
    if (error || !data) return setFehler(error ? fehlertext(error) : 'Die Absage konnte nicht gespeichert werden.');
    setFertig('absage');
  }

  async function senden() {
    setLaedt(true);
    setFehler(null);
    const { data, error } = await supabase.rpc('bj_antworten', {
      p_jagd: jagdId,
      p_code: code,
      p_name: name,
      p_anschrift: anschrift,
      p_telefon: telefon,
      p_zusage: true,
      p_hund: hund,
      p_hornblaeser: horn,
      p_auto: auto,
      p_plaetze: Number(plaetze) || 0,
      p_schuesseltreiben: j.schuesseltreiben ? schuessel || j.anmeldung_pflicht : false,
    });
    setLaedt(false);
    if (error || !data) return setFehler(error ? fehlertext(error) : 'Die Zusage konnte nicht gespeichert werden.');
    setFertig('zusage');
  }

  return (
    <main className="bj-teiln">
      <div>
        <h1>{j.titel}</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)' }}>
          {j.art} · {datumDE(j.datum)}
          {j.uhrzeit ? `, ${j.uhrzeit.slice(0, 5)} Uhr` : ''}
        </p>
      </div>

      <Suspense fallback={<div className="laden">Karte wird geladen …</div>}>
        <BjKarte marker={marker} />
      </Suspense>
      <div className="bj-legende" aria-hidden="true">
        <span>⚑ Treffpunkt</span>
        <span style={{ color: '#c0392b' }}>● Drückjagdböcke</span>
        {daten.ich.einrichtung_id && <span style={{ color: '#f26a1b' }}>★ Dein Stand</span>}
      </div>
      {daten.ich.einrichtung_id ? <Hinweis art="info">Dein Stand ist auf der Karte mit ★ markiert.</Hinweis> : <Hinweis>Dir wurde noch kein Stand zugewiesen.</Hinweis>}

      {daten.ich.status === 'zugesagt' && <Anstellinfo daten={daten} />}

      {geschlossen && <Hinweis art="fehler">Diese Jagd ist abgeschlossen. Antworten sind nicht mehr möglich.</Hinweis>}
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}

      {!geschlossen && schritt === 0 && (
        <>
          <Gruppe titel="1 · Deine Angaben">
            <Feld label="Name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            <Feld label="Anschrift" value={anschrift} onChange={(e) => setAnschrift(e.target.value)} autoComplete="street-address" placeholder="Straße, PLZ Ort" />
            <Feld label="Telefon (optional)" type="tel" value={telefon} onChange={(e) => setTelefon(e.target.value)} autoComplete="tel" placeholder="für Rückfragen am Jagdtag" />
          </Gruppe>
          <Knopf variante="akzent" disabled={!name.trim()} onClick={() => setSchritt(1)}>Weiter</Knopf>
        </>
      )}

      {!geschlossen && schritt === 1 && (
        <>
          <Gruppe titel="2 · Nimmst du teil?">
            <div style={{ padding: '10px var(--abstand)' }}>
              <Segmente label="Teilnahme" optionen={[{ wert: 'ja', label: 'Zusage' }, { wert: 'nein', label: 'Absage' }]} wert={zusage === null ? ('' as 'ja') : zusage ? 'ja' : 'nein'} onAendern={(v) => { setZusage(v === 'ja'); setWarnung(v === 'nein'); }} />
            </div>
          </Gruppe>
          {warnung && zusage === false && (
            <div className="bj-warnung" role="alertdialog" aria-label="Absage bestätigen">
              <strong>Wirklich absagen?</strong>
              <span>Wenn du absagst, werden deine Daten sofort gelöscht. Danach kannst du dich nur noch mit einer neuen Einladung anmelden.</span>
              <div className="bj-dialog-knoepfe">
                <Knopf variante="ghost" onClick={() => { setWarnung(false); setZusage(null); }}>Abbrechen</Knopf>
                <Knopf variante="gefahr" disabled={laedt} onClick={() => void absagen()}>Endgültig absagen</Knopf>
              </div>
            </div>
          )}
          <div className="bj-dialog-knoepfe">
            <Knopf variante="ghost" onClick={() => setSchritt(0)}>Zurück</Knopf>
            {zusage && <Knopf variante="akzent" onClick={() => setSchritt(2)}>Weiter</Knopf>}
          </div>
        </>
      )}

      {!geschlossen && schritt === 2 && (
        <>
          <Gruppe titel="3 · Details zur Jagd">
            {links && (
              <div className="bj-text">
                <span>Treffpunkt – Navigation starten</span>
                <div className="bj-nav-links">
                  <a className="knopf knopf-sekundaer" href={links.apple} target="_blank" rel="noreferrer">Apple Karten</a>
                  <a className="knopf knopf-sekundaer" href={links.google} target="_blank" rel="noreferrer">Google Maps</a>
                </div>
              </div>
            )}
            {j.einladungstext && <div className="bj-text"><span style={{ whiteSpace: 'pre-wrap', color: 'inherit' }}>{j.einladungstext}</span></div>}
            {j.schuesseltreiben && (
              <div className="bj-text">
                <span>Schüsseltreiben{j.schuesseltreiben_adresse ? `: ${j.schuesseltreiben_adresse}` : ''}</span>
                {j.anmeldung_pflicht ? (
                  <span style={{ color: 'inherit' }}>Die Anmeldung zum Schüsseltreiben ist verpflichtend – mit deiner Zusage meldest du dich an.</span>
                ) : (
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="checkbox" checked={schuessel} onChange={(e) => setSchuessel(e.target.checked)} /> Ich nehme am Schüsseltreiben teil
                  </label>
                )}
              </div>
            )}
            {j.hegebeitrag_aktiv && <div className="bj-text"><span style={{ color: 'inherit' }}>Hegebeitrag: <strong>{betrag}</strong></span></div>}
          </Gruppe>
          <Gruppe titel="Deine Angaben für die Planung">
            <label className="bj-ja-nein"><span>Ich bringe einen Hund mit</span><input type="checkbox" checked={hund} onChange={(e) => setHund(e.target.checked)} /></label>
            <label className="bj-ja-nein"><span>Ich bin Jagdhornbläser</span><input type="checkbox" checked={horn} onChange={(e) => setHorn(e.target.checked)} /></label>
            <label className="bj-ja-nein"><span>Ich komme mit dem Auto</span><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /></label>
            {auto && <Feld label="Freie Mitfahrplätze" type="number" min={0} max={20} inputMode="numeric" value={plaetze} onChange={(e) => setPlaetze(e.target.value)} />}
          </Gruppe>
          <div className="bj-dialog-knoepfe">
            <Knopf variante="ghost" onClick={() => setSchritt(1)}>Zurück</Knopf>
            <Knopf variante="akzent" disabled={laedt} onClick={() => void senden()}>{laedt ? 'Sende …' : 'Zusage senden'}</Knopf>
          </div>
        </>
      )}
    </main>
  );
}

// Anstellinformation nach der Zusage: Ansteller, Jagdleitung, Treffpunkt/Zeit, Rettungspunkte
function Anstellinfo({ daten }: { daten: BjLadeErgebnis }) {
  const j = daten.jagd;
  const leitung = daten.jagdleitung ?? [];
  const rettung = daten.rettungspunkte ?? [];
  const telLink = (t: string | null) => (t ? <> · <a href={`tel:${t.replace(/[^+\d]/g, '')}`}>{t}</a></> : null);
  if (!daten.ansteller && leitung.length === 0 && rettung.length === 0) return null;
  return (
    <Gruppe titel="Deine Anstellinformation">
      <div className="bj-text">
        <span style={{ color: 'inherit' }}>
          <strong>Treffpunkt und Zeit:</strong> {datumDE(j.datum)}
          {j.uhrzeit ? `, ${j.uhrzeit.slice(0, 5)} Uhr` : ''}
        </span>
        {daten.ansteller && (
          <span style={{ color: 'inherit' }}>
            <strong>Dein Ansteller:</strong> {daten.ansteller.name}
            {telLink(daten.ansteller.telefon)}
          </span>
        )}
        {leitung.map((l, i) => (
          <span key={i} style={{ color: 'inherit' }}>
            <strong>{l.funktion || 'Jagdleitung'}:</strong> {l.name}
            {telLink(l.telefon)}
          </span>
        ))}
        {rettung.length > 0 && (
          <span style={{ color: 'inherit' }}>
            <strong>Rettungspunkte</strong> (auf der Karte mit + markiert):
            <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
              {rettung.map((r) => (
                <li key={r.id}>
                  {r.name}
                  {r.bemerkung ? ` – ${r.bemerkung}` : ''}{' '}
                  <a href={navigationsLinks(r.lat, r.lng).google} target="_blank" rel="noreferrer">Navigation</a>
                </li>
              ))}
            </ul>
          </span>
        )}
      </div>
    </Gruppe>
  );
}
