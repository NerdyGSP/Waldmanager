import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import type { Geometry } from 'geojson';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import type { Tables } from '../../lib/database.types';
import { Feld, Gruppe, Hinweis, Knopf, Leer } from '../../components/ui';
import type { BjMarker } from './BjKarte';

const BjKarte = lazy(() => import('./BjKarte'));
const kartenLaden = <div className="laden">Karte wird geladen …</div>;

export type Jagdleiter = Tables<'bewegungsjagd_jagdleitung'>;
export type Rettungspunkt = Tables<'bewegungsjagd_rettungspunkte'>;
type Jagd = Tables<'bewegungsjagden'>;
type Teilnehmer = Tables<'bewegungsjagd_teilnehmer'>;
export type Stand = { id: string; name: string | null; typ: string; lng: number; lat: number };

// Jagdleitung, Rettungspunkte und Infotext einer Bewegungsjagd laden
export function useBjVorbereitung(jagdId: string) {
  const [leitung, setLeitung] = useState<Jagdleiter[]>([]);
  const [rettung, setRettung] = useState<Rettungspunkt[]>([]);
  const laden = useCallback(async () => {
    const [l, r] = await Promise.all([
      supabase.from('bewegungsjagd_jagdleitung').select('*').eq('bewegungsjagd_id', jagdId).order('sortierung').order('erstellt_am'),
      supabase.from('bewegungsjagd_rettungspunkte').select('*').eq('bewegungsjagd_id', jagdId).order('erstellt_am'),
    ]);
    setLeitung(l.data ?? []);
    setRettung(r.data ?? []);
  }, [jagdId]);
  useEffect(() => {
    void laden();
  }, [laden]);
  return { leitung, rettung, laden };
}

export function JagdleitungBlock({ jagd, leitung, aenderbar, onGeaendert }: { jagd: Jagd; leitung: Jagdleiter[]; aenderbar: boolean; onGeaendert: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [telefon, setTelefon] = useState('');
  const [funktion, setFunktion] = useState('Jagdleiter');
  const [info, setInfo] = useState(jagd.info_jagdleitung ?? '');
  const [fehler, setFehler] = useState<string | null>(null);
  const [gespeichert, setGespeichert] = useState(false);

  async function hinzufuegen() {
    if (!name.trim()) return;
    const { error } = await supabase.from('bewegungsjagd_jagdleitung').insert({ bewegungsjagd_id: jagd.id, name: name.trim(), telefon: telefon.trim() || null, funktion: funktion.trim() || null, sortierung: leitung.length });
    setFehler(error ? fehlertext(error) : null);
    if (!error) {
      setName('');
      setTelefon('');
      setFunktion('Stellvertreter');
    }
    await onGeaendert();
  }
  async function entfernen(l: Jagdleiter) {
    const { error } = await supabase.from('bewegungsjagd_jagdleitung').delete().eq('id', l.id);
    setFehler(error ? fehlertext(error) : null);
    await onGeaendert();
  }
  async function infoSpeichern() {
    const { error } = await supabase.from('bewegungsjagden').update({ info_jagdleitung: info.trim() || null }).eq('id', jagd.id);
    setFehler(error ? fehlertext(error) : null);
    setGespeichert(!error);
    await onGeaendert();
  }

  return (
    <Gruppe titel="Jagdleitung" fuss="Die Jagdleitung (Name, Telefon) sehen Teilnehmer auf ihrer Anstellinformation; die Infos für die Jagdleitung erscheinen nur in der Jagdtag-Mappe.">
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      {leitung.length === 0 && <Leer>Noch keine Jagdleitung eingetragen.</Leer>}
      {leitung.map((l) => (
        <div key={l.id} className="bj-zeile">
          <span>
            <strong>{l.name}</strong>
            <br />
            <small>{[l.funktion, l.telefon].filter(Boolean).join(' · ')}</small>
          </span>
          {aenderbar && (
            <span className="bj-zeile-aktionen">
              <Knopf variante="gefahr" onClick={() => void entfernen(l)}>Löschen</Knopf>
            </span>
          )}
        </div>
      ))}
      {aenderbar && (
        <div style={{ padding: '0 var(--abstand)' }}>
          <Feld label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Feld label="Telefon" type="tel" value={telefon} onChange={(e) => setTelefon(e.target.value)} />
          <Feld label="Funktion" value={funktion} onChange={(e) => setFunktion(e.target.value)} placeholder="Jagdleiter, Stellvertreter, …" />
          <div className="bj-ja-nein">
            <span />
            <Knopf variante="sekundaer" disabled={!name.trim()} onClick={() => void hinzufuegen()}>Hinzufügen</Knopf>
          </div>
        </div>
      )}
      <label className="bj-text">
        <span>Infos zur Bewegungsjagd für die Jagdleitung</span>
        <textarea value={info} readOnly={!aenderbar} rows={4} onChange={(e) => { setInfo(e.target.value); setGespeichert(false); }} placeholder="z. B. Ablauf, Funkkanal, Treiber, Besonderheiten" />
      </label>
      {aenderbar && (
        <div className="bj-ja-nein">
          <span>{gespeichert ? 'Gespeichert.' : ''}</span>
          <Knopf variante="sekundaer" onClick={() => void infoSpeichern()}>Infos speichern</Knopf>
        </div>
      )}
    </Gruppe>
  );
}

export function RettungspunkteBlock({ jagd, rettung, grenze, treffpunkt, aenderbar, onGeaendert }: { jagd: Jagd; rettung: Rettungspunkt[]; grenze: Geometry | null; treffpunkt: [number, number] | null; aenderbar: boolean; onGeaendert: () => Promise<void> }) {
  const [offen, setOffen] = useState(false);
  const [punkt, setPunkt] = useState<[number, number] | null>(null);
  const [name, setName] = useState('');
  const [bemerkung, setBemerkung] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);

  async function speichern() {
    if (!punkt || !name.trim()) return;
    const { error } = await supabase.from('bewegungsjagd_rettungspunkte').insert({ bewegungsjagd_id: jagd.id, name: name.trim(), bemerkung: bemerkung.trim() || null, lng: punkt[0], lat: punkt[1] });
    setFehler(error ? fehlertext(error) : null);
    if (!error) {
      setOffen(false);
      setPunkt(null);
      setName('');
      setBemerkung('');
    }
    await onGeaendert();
  }
  async function entfernen(r: Rettungspunkt) {
    if (!window.confirm(`Rettungspunkt „${r.name}“ entfernen?`)) return;
    const { error } = await supabase.from('bewegungsjagd_rettungspunkte').delete().eq('id', r.id);
    setFehler(error ? fehlertext(error) : null);
    await onGeaendert();
  }

  const marker: BjMarker[] = [
    ...(treffpunkt ? [{ id: 'tp', lng: treffpunkt[0], lat: treffpunkt[1], art: 'treffpunkt' as const, label: 'Treffpunkt' }] : []),
    ...rettung.map((r) => ({ id: r.id, lng: r.lng, lat: r.lat, art: 'rettung' as const, label: r.name })),
    ...(punkt ? [{ id: 'neu', lng: punkt[0], lat: punkt[1], art: 'rettung' as const, label: name.trim() || 'Neuer Punkt' }] : []),
  ];

  return (
    <Gruppe titel="Rettungspunkte" fuss="Sichtbar auf der Teilnehmerseite, in der Anstellinformation und in den Druckkarten.">
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      {rettung.length === 0 && <Leer>Noch keine Rettungspunkte festgelegt.</Leer>}
      {rettung.map((r) => (
        <div key={r.id} className="bj-zeile">
          <span>
            <strong>{r.name}</strong>
            <br />
            <small>{[r.bemerkung, `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}`].filter(Boolean).join(' · ')}</small>
          </span>
          {aenderbar && (
            <span className="bj-zeile-aktionen">
              <Knopf variante="gefahr" onClick={() => void entfernen(r)}>Löschen</Knopf>
            </span>
          )}
        </div>
      ))}
      {aenderbar && !offen && (
        <div className="bj-ja-nein">
          <span />
          <Knopf variante="sekundaer" onClick={() => setOffen(true)}>+ Rettungspunkt auf Karte setzen</Knopf>
        </div>
      )}
      {aenderbar && offen && (
        <div style={{ padding: '0 var(--abstand) 10px' }}>
          <p style={{ margin: '8px 0', fontSize: '.85rem', color: 'var(--color-text-muted)' }}>Auf die Karte tippen, um den Punkt zu setzen, dann benennen.</p>
          <Suspense fallback={kartenLaden}>
            <BjKarte className="bj-karte bj-karte-hoch" marker={marker} grenze={grenze} waehlbar onWaehlen={(lng, lat) => setPunkt([lng, lat])} />
          </Suspense>
          <Feld label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Rettungspunkt 1 – Waldweg Ost" />
          <Feld label="Bemerkung (optional)" value={bemerkung} onChange={(e) => setBemerkung(e.target.value)} placeholder="z. B. Zufahrt über Feldweg" />
          <div className="bj-ja-nein">
            <Knopf variante="ghost" onClick={() => { setOffen(false); setPunkt(null); }}>Abbrechen</Knopf>
            <Knopf variante="akzent" disabled={!punkt || !name.trim()} onClick={() => void speichern()}>Rettungspunkt speichern</Knopf>
          </div>
        </div>
      )}
    </Gruppe>
  );
}

// Kartendialog „Stand wählen“: freie Stände grün, belegte grau mit Namen des Teilnehmers
export function StandKartenDialog({ teilnehmer, alle, staende, grenze, onWaehlen, onZu }: { teilnehmer: Teilnehmer; alle: Teilnehmer[]; staende: Stand[]; grenze: Geometry | null; onWaehlen: (standId: string, tauschPartner: Teilnehmer | null, modus: 'frei' | 'tauschen' | 'ersetzen') => void; onZu: () => void }) {
  const [rueckfrage, setRueckfrage] = useState<{ stand: Stand; inhaber: Teilnehmer } | null>(null);
  const belegt = (id: string) => alle.find((t) => t.id !== teilnehmer.id && t.aktiv && t.zugeordnete_einrichtung_id === id);
  const label = (e: Stand) => e.name || 'Stand';
  const marker: BjMarker[] = staende.map((e) => {
    if (e.id === teilnehmer.zugeordnete_einrichtung_id) return { id: e.id, lng: e.lng, lat: e.lat, art: 'eigener' as const, label: `${label(e)} (aktuell)` };
    const b = belegt(e.id);
    return b ? { id: e.id, lng: e.lng, lat: e.lat, art: 'belegt' as const, label: `${label(e)}: ${b.name}` } : { id: e.id, lng: e.lng, lat: e.lat, art: 'frei' as const, label: label(e) };
  });

  function klick(id: string) {
    const e = staende.find((s) => s.id === id);
    if (!e || id === teilnehmer.zugeordnete_einrichtung_id) return;
    const b = belegt(id);
    if (b) setRueckfrage({ stand: e, inhaber: b });
    else onWaehlen(id, null, 'frei');
  }

  return (
    <div className="bj-dialog-hintergrund" role="dialog" aria-modal="true" aria-label="Stand wählen">
      <div className="bj-dialog" style={{ width: 'min(760px, 96vw)' }}>
        <strong>Stand für {teilnehmer.name} wählen</strong>
        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '.85rem' }}>Grün = frei, grau = belegt (mit Namen), orange = aktueller Stand. Antippen weist den Stand zu.</p>
        <Suspense fallback={kartenLaden}>
          <BjKarte className="bj-karte bj-karte-hoch" marker={marker} grenze={grenze} onMarkerKlick={klick} />
        </Suspense>
        {rueckfrage && (
          <Hinweis art="warnung">
            <strong>{label(rueckfrage.stand)}</strong> ist von <strong>{rueckfrage.inhaber.name}</strong> belegt. Tauschen oder ersetzen?
            <div className="bj-dialog-knoepfe" style={{ marginTop: 8 }}>
              <Knopf variante="ghost" onClick={() => setRueckfrage(null)}>Abbrechen</Knopf>
              <Knopf variante="sekundaer" onClick={() => onWaehlen(rueckfrage.stand.id, rueckfrage.inhaber, 'ersetzen')}>Ersetzen ({rueckfrage.inhaber.name} verliert den Stand)</Knopf>
              <Knopf variante="akzent" onClick={() => onWaehlen(rueckfrage.stand.id, rueckfrage.inhaber, 'tauschen')}>Tauschen</Knopf>
            </div>
          </Hinweis>
        )}
        <div className="bj-dialog-knoepfe">
          <Knopf variante="ghost" onClick={onZu}>Schließen</Knopf>
        </div>
      </div>
    </div>
  );
}
