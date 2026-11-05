import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { codeAnzeigen, navigationsLinks, zeitraumUhr, type BjLadeErgebnis } from '../../lib/bewegungsjagd';
import { icsHerunterladen } from '../../lib/ics';
import { datumDE } from '../../lib/zeit';
import { Feld, Hinweis, Knopf, Gruppe, Segmente, Zeile } from '../../components/ui';
import type { BjMarker } from './BjKarte';
import { TeilnehmerSelbstDruck } from './BjDruck';

const BjKarte = lazy(() => import('./BjKarte'));

type MailStatus = null | 'sendet' | 'ok' | 'wartet' | 'fehler';

const MAIL_TEXT: Record<Exclude<MailStatus, null | 'sendet'>, string> = {
  ok: 'Die Bestätigung mit Kalendereintrag ist per E-Mail unterwegs.',
  wartet: 'Bitte kurz warten – die letzte Bestätigung wurde gerade erst gesendet.',
  fehler: 'Bestätigungs-Mail konnte nicht gesendet werden. Diese Seite bleibt über deinen Link erreichbar.',
};

const langesDatum = (iso: string, uhrzeit: string | null, ende?: string | null) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + (uhrzeit ? `, ${zeitraumUhr(uhrzeit, ende)}` : '');

// Öffentliche Anmeldeseite /bj/:id – Zugang nur mit Einladungscode, ohne Konto
export function BjTeilnehmer({ jagdId }: { jagdId: string }) {
  const [code, setCode] = useState(() => codeAnzeigen(new URLSearchParams(window.location.search).get('code') ?? ''));
  const [daten, setDaten] = useState<BjLadeErgebnis | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [schritt, setSchritt] = useState(0);
  const [ansicht, setAnsicht] = useState<'assistent' | 'zusage'>('assistent');
  const [abgesagt, setAbgesagt] = useState(false);
  const [absageOffen, setAbsageOffen] = useState(false);
  const [absageFehler, setAbsageFehler] = useState<string | null>(null);
  const [mail, setMail] = useState<MailStatus>(null);
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

  async function laden(c = code, erstesLaden = false) {
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
    if (d.ich.status === 'zugesagt') {
      setZusage(true);
      if (erstesLaden) setAnsicht('zusage');
    }
  }

  useEffect(() => {
    if (code.replace('-', '').length === 8) void laden(code, true);
    // einmalig mit dem Code aus dem Link
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function bestaetigen() {
    setMail('sendet');
    const { data, error } = await supabase.functions.invoke('bj-bestaetigen', { body: { jagd_id: jagdId, code } });
    const r = data as { ok?: boolean; wartet?: boolean } | null;
    setMail(error ? 'fehler' : r?.wartet ? 'wartet' : r?.ok ? 'ok' : 'fehler');
  }

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

  // ----- Code-Eingabe -----
  if (!daten) {
    return (
      <main className="bj-teiln">
        <h1>Einladung zur Bewegungsjagd</h1>
        <Gruppe titel="Einladungscode" fuss="Den Code findest du in deiner Einladungs-E-Mail (Format XXXX-XXXX).">
          <Feld label="Code" value={code} autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={9} onChange={(e) => setCode(codeAnzeigen(e.target.value))} />
        </Gruppe>
        {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
        <Knopf variante="akzent" disabled={laedt || code.replace('-', '').length !== 8} onClick={() => void laden(code, true)}>
          {laedt ? 'Prüfe …' : 'Weiter'}
        </Knopf>
      </main>
    );
  }

  const j = daten.jagd;
  const links = j.lat != null && j.lng != null ? navigationsLinks(j.lat, j.lng) : null;
  const betrag = j.hegebeitrag_betrag != null ? Number(j.hegebeitrag_betrag).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : '';
  const geschlossen = j.status !== 'offen';

  // ----- Absage-Seite -----
  if (abgesagt) {
    return (
      <main className="bj-teiln">
        <Ergebnis titel={j.titel} status="Absage eingegangen">
          <p style={{ margin: '8px 0 0' }}>Deine Daten wurden gelöscht.</p>
        </Ergebnis>
      </main>
    );
  }

  async function absagen(grund: string) {
    setLaedt(true);
    setAbsageFehler(null);
    const { data, error } = await supabase.rpc('bj_absagen_loeschen', { p_jagd: jagdId, p_code: code, p_grund: grund.trim() || undefined });
    setLaedt(false);
    if (error || !data) return setAbsageFehler(error ? fehlertext(error) : 'Die Absage konnte nicht gesendet werden. Bitte versuche es erneut.');
    setAbsageOffen(false);
    setAbgesagt(true);
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
    if (error || !data) {
      setLaedt(false);
      return setFehler(error ? fehlertext(error) : 'Die Zusage konnte nicht gespeichert werden.');
    }
    await laden(code);
    setSchritt(0);
    setAnsicht('zusage');
    void bestaetigen();
  }

  const absageDialog = absageOffen && (
    <AbsageDialog titel={j.titel} datum={datumDE(j.datum)} laedt={laedt} fehler={absageFehler} onAbbrechen={() => { setAbsageOffen(false); setAbsageFehler(null); if (ansicht === 'assistent') setZusage(daten.ich.status === 'zugesagt' ? true : null); }} onSenden={(g) => void absagen(g)} />
  );

  // ----- Zusage-Ansicht -----
  if (ansicht === 'zusage' && daten.ich.status === 'zugesagt') {
    const eigenerStand = daten.stand;
    const standLinks = eigenerStand ? navigationsLinks(eigenerStand.lat, eigenerStand.lng) : null;
    const anreise = auto ? `Auto, ${Number(plaetze) || 0} freie Plätze` : 'ohne Auto';
    const schuesselText = j.schuesseltreiben ? (j.anmeldung_pflicht ? 'verpflichtend' : schuessel ? 'Ja' : 'Nein') : null;
    return (
      <main className="bj-teiln">
        <Ergebnis titel={j.titel} status={geschlossen ? 'Zusage gespeichert – Jagd abgeschlossen' : 'Zusage gespeichert'}>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)' }}>{j.art}</p>
          <p style={{ margin: '2px 0 0' }}>{langesDatum(j.datum, j.uhrzeit, j.ende_uhrzeit)}</p>
        </Ergebnis>
        {geschlossen && <Hinweis>Diese Jagd ist abgeschlossen. Änderungen sind nicht mehr möglich.</Hinweis>}
        {mail === 'sendet' && <Hinweis>Bestätigung wird gesendet …</Hinweis>}
        {mail && mail !== 'sendet' && <Hinweis art={mail === 'ok' ? 'erfolg' : mail === 'wartet' ? 'info' : 'warnung'}>{MAIL_TEXT[mail]}</Hinweis>}

        <Gruppe titel="Deine Angaben">
          <Zeile label="Name" wert={name} />
          <Zeile label="Anschrift" wert={anschrift || '–'} />
          <Zeile label="Telefon" wert={telefon || '–'} />
          <Zeile label="Hund" wert={hund ? 'Ja' : 'Nein'} />
          <Zeile label="Hornbläser" wert={horn ? 'Ja' : 'Nein'} />
          <Zeile label="Anreise" wert={anreise} />
          {schuesselText && <Zeile label="Schüsseltreiben" wert={schuesselText} />}
          {!geschlossen && (
            <div className="bj-text">
              <Knopf variante="sekundaer" onClick={() => { setSchritt(0); setAnsicht('assistent'); }}>Ändern</Knopf>
            </div>
          )}
        </Gruppe>

        <Gruppe titel="Dein Stand">
          <Suspense fallback={<div className="laden">Karte wird geladen …</div>}>
            <BjKarte marker={marker} />
          </Suspense>
          {eigenerStand ? (
            <div className="bj-text">
              <span style={{ color: 'inherit' }}>★ <strong>{eigenerStand.name ?? 'Dein Stand'}</strong></span>
              {standLinks && (
                <div className="bj-nav-links">
                  <a className="knopf knopf-sekundaer" href={standLinks.apple} target="_blank" rel="noreferrer">Apple Karten</a>
                  <a className="knopf knopf-sekundaer" href={standLinks.google} target="_blank" rel="noreferrer">Google Maps</a>
                </div>
              )}
            </div>
          ) : (
            <div className="bj-text"><span style={{ color: 'inherit' }}>Dein Stand wird noch zugewiesen. Du findest ihn hier über deinen Link.</span></div>
          )}
        </Gruppe>

        <Anstellinfo daten={daten} />

        <Gruppe titel="Das Wichtigste">
          {links && (
            <div className="bj-text">
              <span style={{ color: 'inherit' }}>Treffpunkt – Navigation starten</span>
              <div className="bj-nav-links">
                <a className="knopf knopf-sekundaer" href={links.apple} target="_blank" rel="noreferrer">Apple Karten</a>
                <a className="knopf knopf-sekundaer" href={links.google} target="_blank" rel="noreferrer">Google Maps</a>
              </div>
            </div>
          )}
          {j.hegebeitrag_aktiv && <Zeile label="Hegebeitrag" wert={betrag} />}
          {j.schuesseltreiben && <Zeile label="Schüsseltreiben" wert={j.schuesseltreiben_adresse || 'Adresse folgt'} />}
        </Gruppe>

        <Gruppe titel="Aktionen">
          <div className="bj-text">
            <div className="bj-dialog-knoepfe" style={{ justifyContent: 'flex-start' }}>
              <Knopf
                variante="sekundaer"
                onClick={() =>
                  icsHerunterladen({
                    uid: daten.ich.id ?? jagdId,
                    titel: j.titel,
                    datum: j.datum,
                    uhrzeit: j.uhrzeit,
                    ende: j.ende_uhrzeit,
                    lat: j.lat,
                    lng: j.lng,
                    beschreibung: `Deine Seite: ${window.location.origin}/bj/${jagdId}?code=${code}`,
                    url: `${window.location.origin}/bj/${jagdId}?code=${code}`,
                  })
                }
              >
                Zum Kalender
              </Knopf>
              <Knopf variante="sekundaer" onClick={() => setDruck(true)}>Zusammenfassung drucken</Knopf>
              {!geschlossen && (
                <Knopf variante="sekundaer" disabled={mail === 'sendet'} onClick={() => void bestaetigen()}>
                  Bestätigung per E-Mail erneut senden
                </Knopf>
              )}
            </div>
          </div>
        </Gruppe>

        {!geschlossen && (
          <div className="bj-absagen-zeile">
            <Knopf variante="ghost" className="bj-absagen" onClick={() => { setAbsageFehler(null); setAbsageOffen(true); }}>Absagen</Knopf>
          </div>
        )}

        {druck && (
          <TeilnehmerSelbstDruck
            jagd={{
              titel: j.titel,
              art: j.art,
              datum: j.datum,
              uhrzeit: j.uhrzeit,
              ende_uhrzeit: j.ende_uhrzeit ?? null,
              lng: j.lng,
              lat: j.lat,
              schuesseltreiben: j.schuesseltreiben,
              schuesseltreiben_adresse: j.schuesseltreiben_adresse,
              anmeldung_pflicht: j.anmeldung_pflicht,
              hegebeitrag_aktiv: j.hegebeitrag_aktiv,
              hegebeitrag_betrag: j.hegebeitrag_betrag,
              einladungstext: j.einladungstext,
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
        {absageDialog}
      </main>
    );
  }

  // ----- Assistent -----
  return (
    <main className="bj-teiln">
      <div>
        <h1>{j.titel}</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)' }}>
          {j.art} · {datumDE(j.datum)}
          {j.uhrzeit ? `, ${zeitraumUhr(j.uhrzeit, j.ende_uhrzeit)}` : ''}
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

      {geschlossen && <Hinweis art="fehler">Diese Jagd ist abgeschlossen. Antworten sind nicht mehr möglich.</Hinweis>}
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}

      {!geschlossen && schritt === 0 && (
        <>
          <Gruppe titel="1 · Deine Angaben">
            <Feld label="Name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            <Feld label="Anschrift" value={anschrift} onChange={(e) => setAnschrift(e.target.value)} autoComplete="street-address" placeholder="Straße, PLZ Ort" />
            <Feld label="Telefon (optional)" type="tel" value={telefon} onChange={(e) => setTelefon(e.target.value)} autoComplete="tel" placeholder="für Rückfragen am Jagdtag" />
          </Gruppe>
          <div className="bj-dialog-knoepfe">
            {daten.ich.status === 'zugesagt' && <Knopf variante="ghost" onClick={() => setAnsicht('zusage')}>Zurück zur Zusage</Knopf>}
            <Knopf variante="akzent" disabled={!name.trim()} onClick={() => setSchritt(1)}>Weiter</Knopf>
          </div>
        </>
      )}

      {!geschlossen && schritt === 1 && (
        <>
          <Gruppe titel="2 · Nimmst du teil?">
            <div style={{ padding: '10px var(--abstand)' }}>
              <Segmente
                label="Teilnahme"
                optionen={[{ wert: 'ja', label: 'Zusage' }, { wert: 'nein', label: 'Absage' }]}
                wert={zusage === null ? ('' as 'ja') : zusage ? 'ja' : 'nein'}
                onAendern={(v) => {
                  setZusage(v === 'ja');
                  if (v === 'nein') { setAbsageFehler(null); setAbsageOffen(true); }
                }}
              />
            </div>
          </Gruppe>
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
      {absageDialog}
    </main>
  );
}

// Kopf mit Haken; Fokus auf der Überschrift, Status in einer aria-live-Region
function Ergebnis({ titel, status, children }: { titel: string; status: string; children?: React.ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <header className="bj-ergebnis">
      <span className="bj-haken" aria-hidden="true">✓</span>
      <div>
        <p className="bj-status" role="status" aria-live="polite">{status}</p>
        <h1 ref={ref} tabIndex={-1}>{titel}</h1>
        {children}
      </div>
    </header>
  );
}

// Absage-Dialog: Fokusfalle, Escape und Klick auf den Hintergrund = Abbrechen
function AbsageDialog({ titel, datum, laedt, fehler, onAbbrechen, onSenden }: { titel: string; datum: string; laedt: boolean; fehler: string | null; onAbbrechen: () => void; onSenden: (grund: string) => void }) {
  const [grund, setGrund] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const doch = useRef<HTMLButtonElement>(null);
  const abbrechen = useCallback(() => { if (!laedt) onAbbrechen(); }, [laedt, onAbbrechen]);
  useEffect(() => {
    const zuvor = document.activeElement as HTMLElement | null;
    doch.current?.focus();
    return () => zuvor?.focus?.();
  }, []);
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return abbrechen();
      if (e.key !== 'Tab' || !box.current) return;
      const el = [...box.current.querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled])')];
      if (!el.length) return;
      const erstes = el[0]!;
      const letztes = el[el.length - 1]!;
      if (!box.current.contains(document.activeElement)) { e.preventDefault(); erstes.focus(); }
      else if (e.shiftKey && document.activeElement === erstes) { e.preventDefault(); letztes.focus(); }
      else if (!e.shiftKey && document.activeElement === letztes) { e.preventDefault(); erstes.focus(); }
    };
    document.addEventListener('keydown', taste);
    return () => document.removeEventListener('keydown', taste);
  }, [abbrechen]);
  return (
    <div className="bj-abs-overlay" onClick={abbrechen}>
      <div ref={box} className="bj-abs" role="alertdialog" aria-modal="true" aria-labelledby="bj-abs-titel" aria-describedby="bj-abs-text" onClick={(e) => e.stopPropagation()}>
        <h2 id="bj-abs-titel">Absage für {titel} am {datum}?</h2>
        <p id="bj-abs-text">Deine Angaben werden sofort gelöscht. Dein Stand wird frei. Dein Code wird ungültig – für eine spätere Teilnahme brauchst du eine neue Einladung.</p>
        <label className="bj-abs-grund">
          <span>Grund (optional)</span>
          <textarea rows={3} maxLength={200} value={grund} disabled={laedt} onChange={(e) => setGrund(e.target.value)} />
          <small>{grund.length}/200 · Nur für den Revierinhaber sichtbar, wird nach 30 Tagen gelöscht.</small>
        </label>
        {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
        <div className="bj-dialog-knoepfe">
          <button ref={doch} type="button" className="knopf knopf-akzent" onClick={abbrechen}>Doch teilnehmen</button>
          <button type="button" className="knopf knopf-gefahr" disabled={laedt} onClick={() => onSenden(grund)}>{laedt ? 'Sende …' : 'Absage senden'}</button>
        </div>
      </div>
    </div>
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
    <Gruppe titel="Anstellinformation">
      <div className="bj-text">
        <span style={{ color: 'inherit' }}>
          <strong>Treffpunkt und Zeit:</strong> {datumDE(j.datum)}
          {j.uhrzeit ? `, ${zeitraumUhr(j.uhrzeit, j.ende_uhrzeit)}` : ''}
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
