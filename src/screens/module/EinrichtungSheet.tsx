import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { navigationsLinks } from '../../lib/bewegungsjagd';
import { EinrichtungsIcon } from '../../lib/einrichtungsIcons';
import { EINRICHTUNGSTYPEN, nameVergeben } from '../../lib/stammdaten';
import { navigieren } from '../../lib/router';
import { datumDE } from '../../lib/zeit';
import type { Enums } from '../../lib/database.types';
import { EinrichtungsOptionen } from '../../components/EinrichtungsOptionen';
import { Auswahl, Feld, Hinweis, Knopf } from '../../components/ui';
import { abstandM } from '../../lib/gpsPruefung';
import type { RevierKontext } from './kontext';

export type EinrichtungInfo = { id: string; name: string | null; typ: Enums<'einrichtung_typ'>; bemerkung: string | null; lng: number; lat: number };

const WARN_GENAUIGKEIT_M = 15;
const entfernungText = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} km`);

// Bottom-Sheet zu einer angetippten Einrichtung (gleiche Optik wie das WTE-Zonen-Sheet)
export function EinrichtungSheet({
  k,
  einr,
  vergebeneNamen,
  onSchliessen,
  onGeaendert,
  onVerschieben,
  onPosition,
  startAnsicht,
}: {
  k: RevierKontext;
  einr: EinrichtungInfo;
  vergebeneNamen: Array<string | null>;
  onSchliessen: () => void;
  onGeaendert: (text: string) => void;
  onVerschieben: () => void;
  onPosition: (lng: number, lat: number) => Promise<'gespeichert' | 'gemerkt'>;
  startAnsicht?: 'bearbeiten' | 'loeschen';
}) {
  const typ = EINRICHTUNGSTYPEN.find((t) => t.wert === einr.typ);
  const [pos, setPos] = useState<{ lng: number; lat: number } | null>(null);
  const [ansicht, setAnsicht] = useState<'start' | 'bearbeiten' | 'einmessen' | 'loeschen'>(startAnsicht ?? 'start');
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  // bearbeiten
  const [name, setName] = useState(einr.name ?? '');
  const [typWert, setTypWert] = useState(einr.typ);
  const [bemerkung, setBemerkung] = useState(einr.bemerkung ?? '');
  // einmessen
  const [messung, setMessung] = useState<{ lng: number; lat: number; genau: number } | null>(null);
  const [misst, setMisst] = useState(false);
  // löschen
  const [jagden, setJagden] = useState<string[]>([]);

  useEffect(() => {
    // Entfernung zur aktuellen Position (einmalig, grob)
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setPos({ lng: p.coords.longitude, lat: p.coords.latitude }),
      () => undefined,
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 8000 },
    );
  }, [einr.id]);

  useEffect(() => {
    if (startAnsicht === 'loeschen') void loeschenPruefen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zurueck = () => (startAnsicht ? onSchliessen() : setAnsicht('start'));
  const links = navigationsLinks(einr.lat, einr.lng);
  const distanz = pos ? abstandM(pos, { lng: einr.lng, lat: einr.lat }) : null;
  const doppelt = !!name.trim() && nameVergeben(vergebeneNamen, name, einr.name);

  async function speichernBearbeiten() {
    setFehler(null);
    if (doppelt) return;
    setLaeuft(true);
    const { error } = await supabase.from('einrichtungen').update({ name: name.trim() || null, typ: typWert, bemerkung: bemerkung.trim() || null }).eq('id', einr.id);
    setLaeuft(false);
    if (error) setFehler(error.code === '23505' ? `Eine Einrichtung „${name.trim()}“ gibt es in diesem Revier bereits.` : fehlertext(error));
    else onGeaendert('Einrichtung gespeichert');
  }

  function messen() {
    setAnsicht('einmessen');
    setMessung(null);
    setFehler(null);
    if (!navigator.geolocation) {
      setFehler('Dieses Gerät kann den Standort nicht bestimmen.');
      return;
    }
    setMisst(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setMessung({ lng: p.coords.longitude, lat: p.coords.latitude, genau: p.coords.accuracy });
        setMisst(false);
      },
      () => {
        setMisst(false);
        setFehler('Standort nicht verfügbar – bitte Ortungsfreigabe prüfen.');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  }

  async function uebernehmen() {
    if (!messung) return;
    setLaeuft(true);
    try {
      const r = await onPosition(messung.lng, messung.lat);
      onGeaendert(r === 'gemerkt' ? 'Position auf dem Gerät gespeichert – wird übertragen, sobald du online bist' : 'Position eingemessen');
    } catch (err) {
      setFehler(fehlertext(err));
    } finally {
      setLaeuft(false);
    }
  }

  async function loeschenPruefen() {
    setAnsicht('loeschen');
    setFehler(null);
    const { data } = await supabase.from('bewegungsjagd_teilnehmer').select('bewegungsjagden(titel, datum)').eq('zugeordnete_einrichtung_id', einr.id);
    const titel = (data ?? []).map((x) => x.bewegungsjagden).filter((j): j is { titel: string; datum: string } => !!j).map((j) => `${j.titel}${j.datum ? ` (${datumDE(j.datum)})` : ''}`);
    setJagden([...new Set(titel)]);
  }

  async function loeschen() {
    setLaeuft(true);
    setFehler(null);
    // Zuordnungen lösen (wie ON DELETE SET NULL), Erfassungen bleiben erhalten
    const e1 = await supabase.from('bewegungsjagd_teilnehmer').update({ zugeordnete_einrichtung_id: null }).eq('zugeordnete_einrichtung_id', einr.id);
    const e2 = e1.error ? e1 : await supabase.from('einrichtungen').update({ geloescht_am: new Date().toISOString() }).eq('id', einr.id);
    setLaeuft(false);
    if (e2.error) setFehler(fehlertext(e2.error));
    else onGeaendert('Einrichtung gelöscht');
  }

  return (
    <div className="wte-sheet einr-sheet" role="dialog" aria-label={`Einrichtung ${einr.name ?? typ?.label ?? ''}`}>
      <div className="wte-sheet-kopf">
        <span style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
          <EinrichtungsIcon typ={einr.typ} farbe={typ?.farbe ?? '#5d6d7e'} groesse={34} />
          <span style={{ minWidth: 0 }}>
            <strong style={{ display: 'block' }}>{einr.name || typ?.label}</strong>
            <small style={{ color: 'var(--color-text-muted)' }}>
              {typ?.label}
              {distanz !== null ? ` · ${entfernungText(distanz)} entfernt` : ''}
            </small>
          </span>
        </span>
        <button type="button" className="link" onClick={onSchliessen} aria-label="Schließen">
          ✕
        </button>
      </div>
      {einr.bemerkung && ansicht === 'start' && <p style={{ margin: '0 0 6px' }}>{einr.bemerkung}</p>}
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}

      {ansicht === 'start' && (
        <div className="einr-aktionen">
          <a className="knopf knopf-sekundaer" href={links.apple} target="_blank" rel="noreferrer">
            Navigieren · Apple Karten
          </a>
          <a className="knopf knopf-sekundaer" href={links.google} target="_blank" rel="noreferrer">
            Navigieren · Google Maps
          </a>
          {einr.typ === 'falle' && (
            <Knopf variante="akzent" onClick={() => navigieren(`/abschuesse/fang/${einr.id}`)}>
              Fang melden
            </Knopf>
          )}
          {k.istInhaber && (
            <>
              <Knopf variante="sekundaer" onClick={messen}>
                Position einmessen
              </Knopf>
              <Knopf variante="sekundaer" onClick={onVerschieben}>
                Verschieben
              </Knopf>
              <Knopf variante="sekundaer" onClick={() => setAnsicht('bearbeiten')}>
                Bearbeiten
              </Knopf>
              <Knopf variante="gefahr" onClick={() => void loeschenPruefen()}>
                Löschen
              </Knopf>
            </>
          )}
        </div>
      )}

      {ansicht === 'bearbeiten' && (
        <>
          <Feld label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          {doppelt && <Hinweis art="fehler">Eine Einrichtung „{name.trim()}“ gibt es in diesem Revier bereits.</Hinweis>}
          <Auswahl label="Typ" value={typWert} onChange={(e) => setTypWert(e.target.value as Enums<'einrichtung_typ'>)}>
            <EinrichtungsOptionen />
          </Auswahl>
          <Feld label="Bemerkung" value={bemerkung} onChange={(e) => setBemerkung(e.target.value)} />
          <div className="einr-aktionen">
            <Knopf variante="ghost" onClick={zurueck}>
              Zurück
            </Knopf>
            <Knopf variante="akzent" disabled={laeuft || doppelt} onClick={() => void speichernBearbeiten()}>
              {laeuft ? 'Speichern …' : 'Speichern'}
            </Knopf>
          </div>
        </>
      )}

      {ansicht === 'einmessen' && (
        <>
          {misst && <Hinweis art="info">Position wird bestimmt …</Hinweis>}
          {messung && (
            <>
              <Hinweis art={messung.genau > WARN_GENAUIGKEIT_M ? 'warnung' : 'info'}>
                Genauigkeit ± {Math.round(messung.genau)} m.
                {messung.genau > WARN_GENAUIGKEIT_M && ` Das ist ungenau (über ${WARN_GENAUIGKEIT_M} m) – besser kurz warten und neu messen.`} Die jetzige Position ({entfernungText(abstandM(messung, { lng: einr.lng, lat: einr.lat }))} von der gespeicherten entfernt) als Standort der Einrichtung übernehmen?
              </Hinweis>
            </>
          )}
          <div className="einr-aktionen">
            <Knopf variante="ghost" onClick={zurueck}>
              Abbrechen
            </Knopf>
            <Knopf variante="sekundaer" disabled={misst} onClick={messen}>
              Neu messen
            </Knopf>
            <Knopf variante="akzent" disabled={!messung || laeuft} onClick={() => void uebernehmen()}>
              Position übernehmen
            </Knopf>
          </div>
        </>
      )}

      {ansicht === 'loeschen' && (
        <>
          <Hinweis art="warnung">
            „{einr.name || typ?.label}“ wirklich löschen? Erfassungen (Abschüsse, Fänge, Aufgaben) bleiben erhalten.
            {jagden.length > 0 && ` Die Einrichtung ist bei ${jagden.length === 1 ? 'der Bewegungsjagd' : 'den Bewegungsjagden'} ${jagden.join(', ')} als Stand zugewiesen – diese Zuweisungen werden aufgehoben.`}
          </Hinweis>
          <div className="einr-aktionen">
            <Knopf variante="ghost" onClick={zurueck}>
              Abbrechen
            </Knopf>
            <Knopf variante="gefahr" disabled={laeuft} onClick={() => void loeschen()}>
              {laeuft ? 'Lösche …' : 'Endgültig löschen'}
            </Knopf>
          </div>
        </>
      )}
    </div>
  );
}

// Bestätigungsleiste beim Verschieben (Marker ziehen, dann bestätigen oder abbrechen)
export function VerschiebeLeiste({ name, laeuft, geaendert, onOk, onAbbrechen }: { name: string; laeuft: boolean; geaendert: boolean; onOk: () => void; onAbbrechen: () => void }) {
  return (
    <div className="wte-leiste" role="status">
      <strong>Verschieben</strong>
      <span>„{name}“ auf der Karte an die neue Stelle ziehen</span>
      <button type="button" className="link" disabled={!geaendert || laeuft} onClick={onOk}>
        Bestätigen
      </button>
      <button type="button" className="link" onClick={onAbbrechen} disabled={laeuft}>
        Abbrechen
      </button>
    </div>
  );
}

