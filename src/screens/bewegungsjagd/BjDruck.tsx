import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { datumDE } from '../../lib/zeit';
import type { Tables } from '../../lib/database.types';
import { Knopf } from '../../components/ui';
import { QrCode } from '../../components/QrCode';
import { navigationsLinks } from '../../lib/bewegungsjagd';
import { EINRICHTUNGSTYPEN } from '../../lib/stammdaten';

type Jagd = Tables<'bewegungsjagden'>;
type Teilnehmer = Tables<'bewegungsjagd_teilnehmer'>;
type Bock = { id: string; lng: number; lat: number; name: string | null };
export type Stand = { id: string; lng: number; lat: number; name: string | null; typ: string; bemerkung?: string | null };

// Gemeinsamer Rahmen: Vollbild-Ebene mit Werkzeugleiste, beim Drucken nur das Blatt
function Druckrahmen({ querformat, onZu, leiste, children }: { querformat: boolean; onZu: () => void; leiste?: React.ReactNode; children: React.ReactNode }) {
  useEffect(() => {
    document.body.classList.add('bj-druckt');
    const stil = document.createElement('style');
    stil.textContent = `@page { size: A4 ${querformat ? 'landscape' : 'portrait'}; margin: 12mm; }`;
    document.head.appendChild(stil);
    return () => {
      document.body.classList.remove('bj-druckt');
      stil.remove();
    };
  }, [querformat]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onZu();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onZu]);
  return createPortal(
    <div className="bj-druck-ebene" role="dialog" aria-modal="true">
      <div className="bj-druck-leiste">
        <Knopf variante="ghost" onClick={onZu}>‹ Zurück</Knopf>
        <Knopf variante="akzent" onClick={() => window.print()}>Drucken / als PDF</Knopf>
        {leiste}
      </div>
      <div className={`bj-druck-blatt ${querformat ? 'quer' : 'hoch'}`}>{children}</div>
    </div>,
    document.body,
  );
}

// ---------- Teilnehmerinfo (A4 hoch) ----------

const R = 6378137;
const mx = (lng: number) => (lng * Math.PI * R) / 180;
const my = (lat: number) => R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

const STANDARD_HINWEIS =
  'Bitte pünktlich am Treffpunkt sein. Jagdschein, Waffenbesitzkarte und Schießnachweis (Gültigkeit im Bundesland prüfen) sind mitzuführen. Signalkleidung ist Pflicht. Den Anweisungen der Jagdleitung ist uneingeschränkt Folge zu leisten.';

export function TeilnehmerInfoDruck({ jagd, boecke, staende, tn, onZu }: { jagd: Jagd; boecke: Bock[]; staende: Stand[]; tn: Teilnehmer[]; onZu: () => void }) {
  const [hinweise, setHinweise] = useState(STANDARD_HINWEIS);
  const [adresse, setAdresse] = useState<string | null>(null);
  const [fuer, setFuer] = useState<string>(''); // '' = allgemein, 'alle' = je Zusage eine Seite, sonst Teilnehmer-ID
  const hatTreffpunkt = jagd.treffpunkt_lng != null && jagd.treffpunkt_lat != null;
  const zusagen = useMemo(() => tn.filter((t) => t.status === 'zugesagt' && t.aktiv).sort((a, b) => a.name.localeCompare(b.name, 'de')), [tn]);

  // Adresse des Treffpunkts (OpenStreetMap Nominatim), nur ein einzelner Abruf
  useEffect(() => {
    if (!hatTreffpunkt) return;
    void fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=de&lat=${jagd.treffpunkt_lat}&lon=${jagd.treffpunkt_lng}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { display_name?: string } | null) => setAdresse(j?.display_name ?? null))
      .catch(() => setAdresse(null));
  }, [hatTreffpunkt, jagd.treffpunkt_lat, jagd.treffpunkt_lng]);

  const luftbild = useMemo(() => {
    if (!hatTreffpunkt) return null;
    const cx = mx(jagd.treffpunkt_lng!);
    const cy = my(jagd.treffpunkt_lat!);
    const halbX = 700;
    const halbY = 500; // Seitenverhältnis 7:5
    const bbox = [cx - halbX, cy - halbY, cx + halbX, cy + halbY];
    const url =
      'https://opendata.lgln.niedersachsen.de/doorman/noauth/dop_wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image/jpeg&LAYERS=ni_dop20&STYLES=&CRS=EPSG:3857' +
      `&WIDTH=1400&HEIGHT=1000&BBOX=${bbox.join(',')}`;
    const pos = (lng: number, lat: number) => ({ x: ((mx(lng) - bbox[0]!) / (bbox[2]! - bbox[0]!)) * 100, y: (1 - (my(lat) - bbox[1]!) / (bbox[3]! - bbox[1]!)) * 100 });
    const innen = (p: { x: number; y: number }) => p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100;
    return {
      url,
      pos,
      innen,
      tp: pos(jagd.treffpunkt_lng!, jagd.treffpunkt_lat!),
      boecke: boecke.map((b) => ({ ...b, ...pos(b.lng, b.lat) })).filter(innen),
    };
  }, [hatTreffpunkt, jagd.treffpunkt_lng, jagd.treffpunkt_lat, boecke]);

  const datumLang = new Date(`${jagd.datum}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const standLabel = (e: Stand) => e.name || (EINRICHTUNGSTYPEN.find((t) => t.wert === e.typ)?.label ?? e.typ);

  const seiten: Array<Teilnehmer | null> = fuer === 'alle' ? zusagen : fuer ? [tn.find((t) => t.id === fuer) ?? null] : [null];

  return (
    <Druckrahmen
      querformat={false}
      onZu={onZu}
      leiste={
        <>
          <label className="bj-druck-hinweise" style={{ flex: '0 1 260px' }}>
            Ausgabe für
            <select value={fuer} onChange={(e) => setFuer(e.target.value)}>
              <option value="">Allgemein (ohne Stand)</option>
              {zusagen.length > 0 && <option value="alle">Alle Zusagen – eine Seite je Teilnehmer</option>}
              {zusagen.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="bj-druck-hinweise">
            Hinweise (anpassbar)
            <textarea value={hinweise} onChange={(e) => setHinweise(e.target.value)} rows={4} />
          </label>
        </>
      }
    >
      {seiten.map((t, i) => {
        const stand = t?.zugeordnete_einrichtung_id ? staende.find((e) => e.id === t.zugeordnete_einrichtung_id) : undefined;
        const standPos = stand && luftbild ? luftbild.pos(stand.lng, stand.lat) : null;
        return (
          <section key={t?.id ?? 'allgemein'} className={i > 0 ? 'bj-druck-seite folge' : 'bj-druck-seite'}>
            <h1>{jagd.titel}</h1>
            <p className="art">{jagd.art}{t ? ` · Teilnehmer: ${t.name}` : ''}</p>
            <table className="bj-druck-tabelle">
              <tbody>
                <tr><th>Datum</th><td>{datumLang}</td></tr>
                {jagd.uhrzeit && <tr><th>Uhrzeit</th><td>{jagd.uhrzeit.slice(0, 5)} Uhr</td></tr>}
                {hatTreffpunkt && (
                  <tr>
                    <th>Treffpunkt</th>
                    <td>
                      {adresse && <>{adresse}<br /></>}
                      <small>{jagd.treffpunkt_lat!.toFixed(5)}, {jagd.treffpunkt_lng!.toFixed(5)}</small>
                    </td>
                  </tr>
                )}
                {t && (
                  <tr>
                    <th>Dein Stand</th>
                    <td>
                      {stand ? (
                        <>
                          <strong>{standLabel(stand)}</strong> ({EINRICHTUNGSTYPEN.find((x) => x.wert === stand.typ)?.label ?? stand.typ})<br />
                          <small>{stand.lat.toFixed(5)}, {stand.lng.toFixed(5)}</small>
                          {stand.bemerkung && <><br /><small>{stand.bemerkung}</small></>}
                        </>
                      ) : (
                        'Noch kein Stand zugewiesen – Zuweisung vor Ort durch die Jagdleitung.'
                      )}
                    </td>
                  </tr>
                )}
                {jagd.schuesseltreiben && (
                  <tr>
                    <th>Schüsseltreiben</th>
                    <td>{jagd.schuesseltreiben_adresse || 'ja'}{jagd.schuesseltreiben_anmeldung_pflicht ? ' · Anmeldung erforderlich' : ''}</td>
                  </tr>
                )}
                {jagd.hegebeitrag_aktiv && <tr><th>Hegebeitrag</th><td>{Number(jagd.hegebeitrag_betrag ?? 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td></tr>}
              </tbody>
            </table>
            {(hatTreffpunkt || stand) && (
              <div className="bj-druck-qrreihe">
                {hatTreffpunkt && (
                  <figure>
                    <QrCode text={navigationsLinks(jagd.treffpunkt_lat!, jagd.treffpunkt_lng!).google} groesse={110} titel="Navigation zum Treffpunkt" />
                    <figcaption>Navigation zum <strong>Treffpunkt</strong><br />QR-Code mit dem Handy scannen</figcaption>
                  </figure>
                )}
                {stand && (
                  <figure>
                    <QrCode text={navigationsLinks(stand.lat, stand.lng).google} groesse={110} titel="Navigation zum Stand" />
                    <figcaption>Navigation zu <strong>deinem Stand</strong><br />QR-Code mit dem Handy scannen</figcaption>
                  </figure>
                )}
              </div>
            )}
            {jagd.einladungstext && <p className="text">{jagd.einladungstext}</p>}
            {hinweise.trim() && (
              <>
                <h2>Hinweise</h2>
                <p className="text">{hinweise}</p>
              </>
            )}
            {luftbild && (
              <div className="bj-druck-karte">
                <img src={luftbild.url} alt="Luftbild um den Treffpunkt" />
                {luftbild.boecke.map((b) => (
                  <span key={b.id} className="bj-druck-bock" style={{ left: `${b.x}%`, top: `${b.y}%` }} title={b.name ?? 'Drückjagdbock'} />
                ))}
                {stand && standPos && luftbild.innen(standPos) && (
                  <span className="bj-druck-eigener" style={{ left: `${standPos.x}%`, top: `${standPos.y}%` }}>Dein Stand</span>
                )}
                <span className="bj-druck-tp" style={{ left: `${luftbild.tp.x}%`, top: `${luftbild.tp.y}%` }}>⚑ Treffpunkt</span>
                <small className="bj-druck-quelle">© LGLN · ● Drückjagdbock · Maßstab ca. 1 : 6.000 (Ausschnitt 1,4 km × 1,0 km)</small>
              </div>
            )}
          </section>
        );
      })}
    </Druckrahmen>
  );
}

// ---------- Teilnehmerliste (A4 quer) ----------

type Sortierung = 'name' | 'status';
const STATUSTEXT: Record<string, string> = { eingeladen: 'offen', zugesagt: 'zugesagt', abgesagt: 'abgesagt' };

export function TeilnehmerListeDruck({ jagd, tn, standName, onZu }: { jagd: Jagd; tn: Teilnehmer[]; standName: (id: string | null) => string; onZu: () => void }) {
  const [filter, setFilter] = useState<'alle' | 'eingeladen' | 'zugesagt' | 'abgesagt'>('zugesagt');
  const [sort, setSort] = useState<Sortierung>('name');
  const liste = useMemo(() => {
    const l = tn.filter((t) => filter === 'alle' || t.status === filter);
    return [...l].sort((a, b) => (sort === 'status' ? a.status.localeCompare(b.status) || a.name.localeCompare(b.name, 'de') : a.name.localeCompare(b.name, 'de')));
  }, [tn, filter, sort]);
  const zu = liste.filter((t) => t.status === 'zugesagt');
  const summe = {
    zusagen: zu.length,
    hunde: zu.filter((t) => t.hat_hund).length,
    plaetze: zu.reduce((s, t) => s + (t.auto_vorhanden ? t.mitfahrplaetze ?? 0 : 0), 0),
    hege: jagd.hegebeitrag_aktiv ? zu.length * Number(jagd.hegebeitrag_betrag ?? 0) : 0,
  };
  const ja = (b: boolean | null) => (b ? 'ja' : '–');
  const stand = new Date().toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <Druckrahmen
      querformat
      onZu={onZu}
      leiste={
        <>
          <label>
            Status{' '}
            <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
              <option value="alle">Alle</option>
              <option value="zugesagt">Zugesagt</option>
              <option value="eingeladen">Offen</option>
              <option value="abgesagt">Abgesagt</option>
            </select>
          </label>
          <label>
            Sortierung{' '}
            <select value={sort} onChange={(e) => setSort(e.target.value as Sortierung)}>
              <option value="name">Name</option>
              <option value="status">Status, dann Name</option>
            </select>
          </label>
        </>
      }
    >
      <h1 style={{ fontSize: '1.3rem' }}>Teilnehmerliste · {jagd.titel}</h1>
      <p className="art">{jagd.art} · {datumDE(jagd.datum)}{jagd.uhrzeit ? `, ${jagd.uhrzeit.slice(0, 5)} Uhr` : ''} · Stand {stand}</p>
      <table className="bj-druck-liste">
        <thead>
          <tr>
            <th>Name</th><th>Anschrift</th><th>E-Mail</th><th>Telefon</th><th>Status</th><th>Stand</th><th>Hund</th><th>Horn</th><th>Auto</th><th>Plätze</th>
            {jagd.schuesseltreiben && <th>Schüsseltr.</th>}
            {jagd.hegebeitrag_aktiv && <th>Hegebeitrag</th>}
          </tr>
        </thead>
        <tbody>
          {liste.map((t) => (
            <tr key={t.id}>
              <td>{t.name}</td>
              <td>{t.anschrift ?? ''}</td>
              <td>{t.email}</td>
              <td>{t.telefon ?? ''}</td>
              <td>{STATUSTEXT[t.status] ?? t.status}</td>
              <td>{standName(t.zugeordnete_einrichtung_id)}</td>
              <td>{ja(t.hat_hund)}</td>
              <td>{ja(t.hat_hornblaeser)}</td>
              <td>{ja(t.auto_vorhanden)}</td>
              <td>{t.auto_vorhanden ? t.mitfahrplaetze ?? 0 : ''}</td>
              {jagd.schuesseltreiben && <td>{ja(t.schuesseltreiben_teilnahme)}</td>}
              {jagd.hegebeitrag_aktiv && <td>{t.status === 'zugesagt' ? Number(jagd.hegebeitrag_betrag ?? 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : ''}</td>}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}><strong>Summe (Zusagen in der Ansicht)</strong></td>
            <td><strong>{summe.zusagen}</strong></td>
            <td />
            <td><strong>{summe.hunde}</strong></td>
            <td colSpan={2} />
            <td><strong>{summe.plaetze}</strong></td>
            {jagd.schuesseltreiben && <td><strong>{zu.filter((t) => t.schuesseltreiben_teilnahme).length}</strong></td>}
            {jagd.hegebeitrag_aktiv && <td><strong>{summe.hege.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</strong></td>}
          </tr>
        </tfoot>
      </table>
      <small className="art">Einladungscodes sind bewusst nicht aufgeführt.</small>
    </Druckrahmen>
  );
}
