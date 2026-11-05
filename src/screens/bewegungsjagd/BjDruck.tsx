import { Fragment, useEffect, useMemo, useState } from 'react';
import { DruckPortal } from '../../components/DruckPortal';
import { datumDE } from '../../lib/zeit';
import type { Tables } from '../../lib/database.types';
import { Knopf } from '../../components/ui';
import { QrCode } from '../../components/QrCode';
import { navigationsLinks, zeitraumUhr } from '../../lib/bewegungsjagd';
import { EINRICHTUNGSTYPEN } from '../../lib/stammdaten';
import { nachAnstellern } from '../../lib/bjGruppen';
import { DruckKarte, teilePunkte, type KartenPunkt } from './DruckKarte';

type Jagd = Tables<'bewegungsjagden'>;
type Teilnehmer = Tables<'bewegungsjagd_teilnehmer'>;
type Jagdleiter = Pick<Tables<'bewegungsjagd_jagdleitung'>, 'name' | 'telefon' | 'funktion'>;
type Rettung = Pick<Tables<'bewegungsjagd_rettungspunkte'>, 'id' | 'name' | 'bemerkung' | 'lng' | 'lat'>;
type Bock = { id: string; lng: number; lat: number; name: string | null };
export type Stand = { id: string; lng: number; lat: number; name: string | null; typ: string; bemerkung?: string | null };

// Gemeinsamer Rahmen: Vollbild-Ebene mit Werkzeugleiste, beim Drucken nur das Blatt
export function Druckrahmen({ querformat, onZu, leiste, children }: { querformat: boolean; onZu: () => void; leiste?: React.ReactNode; children: React.ReactNode }) {
  useEffect(() => {
    const stil = document.createElement('style');
    stil.textContent = `@page { size: A4 ${querformat ? 'landscape' : 'portrait'}; margin: 12mm; }`;
    document.head.appendChild(stil);
    return () => {
      stil.remove();
    };
  }, [querformat]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onZu();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onZu]);
  return (
    <DruckPortal>
    <div className="bj-druck-ebene" role="dialog" aria-modal="true">
      <div className="bj-druck-leiste">
        <Knopf variante="ghost" onClick={onZu}>‹ Zurück</Knopf>
        <Knopf variante="akzent" onClick={() => window.print()}>Drucken / als PDF</Knopf>
        {leiste}
      </div>
      <div className={`bj-druck-blatt ${querformat ? 'quer' : 'hoch'}`}>{children}</div>
    </div>
    </DruckPortal>
  );
}

// ---------- Teilnehmerinfo / Anstellinformation (A4 hoch) ----------

const STANDARD_HINWEIS =
  'Bitte pünktlich am Treffpunkt sein. Jagdschein, Waffenbesitzkarte und Schießnachweis (Gültigkeit im Bundesland prüfen) sind mitzuführen. Signalkleidung ist Pflicht. Den Anweisungen der Jagdleitung ist uneingeschränkt Folge zu leisten.';

// Gemeinsame Daten für Organisator- und Teilnehmer-Ausdruck
export type JagdInfo = {
  titel: string;
  art: string;
  datum: string;
  uhrzeit: string | null;
  ende_uhrzeit?: string | null;
  lng: number | null;
  lat: number | null;
  schuesseltreiben: boolean;
  schuesseltreiben_adresse: string | null;
  anmeldung_pflicht: boolean;
  hegebeitrag_aktiv: boolean;
  hegebeitrag_betrag: number | null;
  einladungstext: string | null;
};
export type TnInfo = { name: string; anschrift?: string | null; telefon?: string | null; hund: boolean; horn: boolean; auto: boolean; plaetze: number; schuessel: boolean };
export type AnstellerInfo = { name: string; telefon: string | null } | null;

const jagdInfo = (j: Jagd): JagdInfo => ({
  titel: j.titel,
  art: j.art,
  datum: j.datum,
  uhrzeit: j.uhrzeit,
  ende_uhrzeit: j.ende_uhrzeit ?? null,
  lng: j.treffpunkt_lng,
  lat: j.treffpunkt_lat,
  schuesseltreiben: j.schuesseltreiben,
  schuesseltreiben_adresse: j.schuesseltreiben_adresse,
  anmeldung_pflicht: j.schuesseltreiben_anmeldung_pflicht,
  hegebeitrag_aktiv: j.hegebeitrag_aktiv,
  hegebeitrag_betrag: j.hegebeitrag_betrag,
  einladungstext: j.einladungstext,
});
const tnInfo = (t: Teilnehmer): TnInfo => ({
  name: t.name,
  anschrift: t.anschrift,
  telefon: t.telefon,
  hund: !!t.hat_hund,
  horn: !!t.hat_hornblaeser,
  auto: !!t.auto_vorhanden,
  plaetze: t.mitfahrplaetze ?? 0,
  schuessel: !!t.schuesseltreiben_teilnahme,
});

const typLabel = (typ: string) => EINRICHTUNGSTYPEN.find((t) => t.wert === typ)?.label ?? typ;
const standLabel = (e: { name: string | null; typ: string }) => e.name || typLabel(e.typ);
const zeitText = (j: { datum: string; uhrzeit: string | null; ende_uhrzeit?: string | null }) =>
  `${new Date(`${j.datum}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}${j.uhrzeit ? `, ${zeitraumUhr(j.uhrzeit, j.ende_uhrzeit)}` : ''}`;

// Adresse des Treffpunkts (OpenStreetMap Nominatim), nur ein einzelner Abruf
function useAdresse(lat: number | null, lng: number | null) {
  const [adresse, setAdresse] = useState<string | null>(null);
  useEffect(() => {
    if (lat == null || lng == null) return;
    void fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=de&lat=${lat}&lon=${lng}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { display_name?: string } | null) => setAdresse(j?.display_name ?? null))
      .catch(() => setAdresse(null));
  }, [lat, lng]);
  return adresse;
}

const tel = (t: string | null | undefined) => (t ? ` · Tel. ${t}` : '');

// Eine Seite der Anstellinformation (A4 hoch)
function InfoSeite({ jagd, tn, stand, boecke, rettung, leitung, ansteller, hinweise, adresse, folge }: { jagd: JagdInfo; tn: TnInfo | null; stand: Stand | undefined; boecke: Bock[]; rettung: Rettung[]; leitung: Jagdleiter[]; ansteller: AnstellerInfo; hinweise: string; adresse: string | null; folge: boolean }) {
  const hatTreffpunkt = jagd.lng != null && jagd.lat != null;
  const ja = (b: boolean) => (b ? 'ja' : 'nein');
  const punkte = useMemo<KartenPunkt[]>(() => {
    const l: KartenPunkt[] = [];
    if (hatTreffpunkt) l.push({ id: 'tp', lng: jagd.lng!, lat: jagd.lat!, art: 'treffpunkt', label: 'Treffpunkt' });
    for (const r of rettung) l.push({ id: `r${r.id}`, lng: r.lng, lat: r.lat, art: 'rettung', label: r.name });
    // Nur der eigene Stand wird benannt; die übrigen Stände erscheinen ohne Namen
    for (const b of boecke) if (!stand || b.id !== stand.id) l.push({ id: `b${b.id}`, lng: b.lng, lat: b.lat, art: 'frei' });
    if (stand) l.push({ id: 'eigener', lng: stand.lng, lat: stand.lat, art: 'eigener', label: 'Dein Stand' });
    return l;
  }, [hatTreffpunkt, jagd.lng, jagd.lat, rettung, boecke, stand]);

  return (
    <section className={folge ? 'bj-druck-seite folge' : 'bj-druck-seite'}>
      <h1>{jagd.titel}</h1>
      <p className="art">{jagd.art}{tn ? ` · Teilnehmer: ${tn.name}` : ''}</p>
      <table className="bj-druck-tabelle">
        <tbody>
          <tr><th>Datum</th><td>{new Date(`${jagd.datum}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</td></tr>
          {jagd.uhrzeit && <tr><th>Uhrzeit</th><td>{zeitraumUhr(jagd.uhrzeit, jagd.ende_uhrzeit)}</td></tr>}
          {hatTreffpunkt && (
            <tr>
              <th>Treffpunkt</th>
              <td>
                {adresse && <>{adresse}<br /></>}
                <small>{jagd.lat!.toFixed(5)}, {jagd.lng!.toFixed(5)}</small>
              </td>
            </tr>
          )}
          {tn && (
            <tr>
              <th>Dein Stand</th>
              <td>
                {stand ? (
                  <>
                    <strong>{standLabel(stand)}</strong> ({typLabel(stand.typ)})<br />
                    <small>{stand.lat.toFixed(5)}, {stand.lng.toFixed(5)}</small>
                    {stand.bemerkung && <><br /><small>{stand.bemerkung}</small></>}
                  </>
                ) : (
                  'Noch kein Stand zugewiesen – Zuweisung vor Ort durch die Jagdleitung.'
                )}
              </td>
            </tr>
          )}
          {tn && ansteller && (
            <tr>
              <th>Dein Ansteller</th>
              <td><strong>{ansteller.name}</strong>{tel(ansteller.telefon)}</td>
            </tr>
          )}
          {leitung.length > 0 && (
            <tr>
              <th>Jagdleitung</th>
              <td>
                {leitung.map((l, i) => (
                  <span key={i}>
                    {i > 0 && <br />}
                    <strong>{l.name}</strong>{l.funktion ? ` (${l.funktion})` : ''}{tel(l.telefon)}
                  </span>
                ))}
              </td>
            </tr>
          )}
          {jagd.schuesseltreiben && (
            <tr>
              <th>Schüsseltreiben</th>
              <td>
                {jagd.schuesseltreiben_adresse || 'ja'}
                {jagd.anmeldung_pflicht ? ' · Anmeldung erforderlich' : ''}
                {tn ? ` · Teilnahme: ${ja(tn.schuessel || jagd.anmeldung_pflicht)}` : ''}
              </td>
            </tr>
          )}
          {jagd.hegebeitrag_aktiv && <tr><th>Hegebeitrag</th><td>{Number(jagd.hegebeitrag_betrag ?? 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td></tr>}
          {tn && (
            <tr>
              <th>Deine Angaben</th>
              <td>
                <small>
                  Hund: {ja(tn.hund)} · Jagdhornbläser: {ja(tn.horn)} · Auto: {tn.auto ? `ja, ${tn.plaetze} Mitfahrplätze` : 'nein'}
                  {tn.telefon ? ` · Tel. ${tn.telefon}` : ''}
                </small>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {(hatTreffpunkt || stand) && (
        <div className="bj-druck-qrreihe">
          {hatTreffpunkt && (
            <figure>
              <QrCode text={navigationsLinks(jagd.lat!, jagd.lng!).google} groesse={110} titel="Navigation zum Treffpunkt" />
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
      {rettung.length > 0 && (
        <>
          <h2>Rettungspunkte</h2>
          <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
            {rettung.map((r) => (
              <li key={r.id}><strong>{r.name}</strong>{r.bemerkung ? ` – ${r.bemerkung}` : ''} <small>({r.lat.toFixed(5)}, {r.lng.toFixed(5)})</small></li>
            ))}
          </ul>
        </>
      )}
      {punkte.length > 0 && <DruckKarte punkte={punkte} breiteMm={186} hoeheMm={82} mindestBreiteM={700} pflichtLabels alt="Luftbild mit Treffpunkt, Ständen und Rettungspunkten" />}
    </section>
  );
}

// Organisator: allgemein, je Teilnehmer oder alle Zusagen
export function TeilnehmerInfoDruck({ jagd, leitung, rettung, boecke, staende, tn, onZu }: { jagd: Jagd; leitung: Jagdleiter[]; rettung: Rettung[]; boecke: Bock[]; staende: Stand[]; tn: Teilnehmer[]; onZu: () => void }) {
  const [hinweise, setHinweise] = useState(STANDARD_HINWEIS);
  const [fuer, setFuer] = useState<string>(''); // '' = allgemein, 'alle' = je Zusage eine Seite, sonst Teilnehmer-ID
  const adresse = useAdresse(jagd.treffpunkt_lat, jagd.treffpunkt_lng);
  const zusagen = useMemo(() => tn.filter((t) => t.status === 'zugesagt' && t.aktiv).sort((a, b) => a.name.localeCompare(b.name, 'de')), [tn]);
  const info = useMemo(() => jagdInfo(jagd), [jagd]);
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
        const a = t?.ansteller_id ? tn.find((x) => x.id === t.ansteller_id) : undefined;
        return (
          <InfoSeite
            key={t?.id ?? 'allgemein'}
            jagd={info}
            tn={t ? tnInfo(t) : null}
            stand={t?.zugeordnete_einrichtung_id ? staende.find((e) => e.id === t.zugeordnete_einrichtung_id) : undefined}
            boecke={boecke}
            rettung={rettung}
            leitung={leitung}
            ansteller={a ? { name: a.name, telefon: a.telefon } : null}
            hinweise={hinweise}
            adresse={adresse}
            folge={i > 0}
          />
        );
      })}
    </Druckrahmen>
  );
}

// Teilnehmer (ohne Konto): dieselbe Anstellinformation für die eigene Zusage
export function TeilnehmerSelbstDruck({ jagd, tn, stand, boecke, rettung, leitung, ansteller, onZu }: { jagd: JagdInfo; tn: TnInfo; stand: Stand | undefined; boecke: Bock[]; rettung: Rettung[]; leitung: Jagdleiter[]; ansteller: AnstellerInfo; onZu: () => void }) {
  const adresse = useAdresse(jagd.lat, jagd.lng);
  return (
    <Druckrahmen querformat={false} onZu={onZu}>
      <InfoSeite jagd={jagd} tn={tn} stand={stand} boecke={boecke} rettung={rettung} leitung={leitung} ansteller={ansteller} hinweise={STANDARD_HINWEIS} adresse={adresse} folge={false} />
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
  const gruppiert = tn.some((t) => t.ist_ansteller);
  const spalten = 10 + (jagd.schuesseltreiben ? 1 : 0) + (jagd.hegebeitrag_aktiv ? 1 : 0);
  const zeile = (t: Teilnehmer) => (
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
  );
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
      <p className="art">{jagd.art} · {datumDE(jagd.datum)}{jagd.uhrzeit ? `, ${zeitraumUhr(jagd.uhrzeit, jagd.ende_uhrzeit)}` : ''} · Stand {stand}</p>
      <table className="bj-druck-liste">
        <thead>
          <tr>
            <th>Name</th><th>Anschrift</th><th>E-Mail</th><th>Telefon</th><th>Status</th><th>Stand</th><th>Hund</th><th>Horn</th><th>Auto</th><th>Plätze</th>
            {jagd.schuesseltreiben && <th>Schüsseltr.</th>}
            {jagd.hegebeitrag_aktiv && <th>Hegebeitrag</th>}
          </tr>
        </thead>
        <tbody>
          {!gruppiert && liste.map((t) => zeile(t))}
          {gruppiert &&
            nachAnstellern(liste).map((g) => (
              <Fragment key={g.ansteller?.id ?? 'ohne'}>
                <tr className="gruppe">
                  <td colSpan={spalten}>{g.ansteller ? `Gruppe ${g.ansteller.name}${g.ansteller.telefon ? ` · Tel. ${g.ansteller.telefon}` : ''}` : 'Ohne Gruppe'}</td>
                </tr>
                {g.ansteller && zeile(g.ansteller)}
                {g.mitglieder.map((t) => zeile(t))}
              </Fragment>
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

// ---------- Jagdtag-Mappe (A4 quer) ----------

const Haken = ({ an }: { an: boolean }) => <span className={`bj-druck-haken ${an ? 'an' : ''}`} aria-label={an ? 'ja' : 'offen'} />;

export type StreckeDruckZeile = { wildart: string; geschlecht: string; altersklasse: string | null; stand: string; erleger: string; uhr: string; gewicht: number | null };

export function JagdtagMappeDruck({ jagd, tn, leitung, rettung, staende, standName, strecke = [], onZu }: { strecke?: StreckeDruckZeile[]; jagd: Jagd; tn: Teilnehmer[]; leitung: Jagdleiter[]; rettung: Rettung[]; staende: Stand[]; standName: (id: string | null) => string; onZu: () => void }) {
  const [detail, setDetail] = useState(true);
  const [anhang, setAnhang] = useState(true);
  const [mitStrecke, setMitStrecke] = useState(true);
  const adresse = useAdresse(jagd.treffpunkt_lat, jagd.treffpunkt_lng);
  const zu = useMemo(() => tn.filter((t) => t.status === 'zugesagt' && t.aktiv), [tn]);
  const gruppiert = zu.some((t) => t.ist_ansteller);
  const boecke = useMemo(() => staende.filter((e) => e.typ === 'drueckjagdbock'), [staende]);
  const inhaber = (eid: string) => zu.find((t) => t.zugeordnete_einrichtung_id === eid);
  const hatTp = jagd.treffpunkt_lng != null && jagd.treffpunkt_lat != null;
  const sonst = useMemo<KartenPunkt[]>(
    () => [
      ...(hatTp ? [{ id: 'tp', lng: jagd.treffpunkt_lng!, lat: jagd.treffpunkt_lat!, art: 'treffpunkt' as const, label: 'Treffpunkt' }] : []),
      ...rettung.map((r) => ({ id: `r${r.id}`, lng: r.lng, lat: r.lat, art: 'rettung' as const, label: r.name })),
    ],
    [hatTp, jagd.treffpunkt_lng, jagd.treffpunkt_lat, rettung],
  );
  const standPunkt = (e: Stand, mitName: boolean): KartenPunkt => {
    const t = inhaber(e.id);
    return { id: `b${e.id}`, lng: e.lng, lat: e.lat, art: t ? 'belegt' : 'frei', label: standLabel(e), label2: mitName && t ? t.name : undefined };
  };
  const uebersicht = useMemo(() => [...sonst, ...boecke.map((e) => standPunkt(e, false))], [sonst, boecke, zu]); // eslint-disable-line react-hooks/exhaustive-deps
  const blaetter = useMemo(() => {
    return teilePunkte(boecke, 8).map((gruppe) => {
      const xs = gruppe.map((e) => e.lng);
      const ys = gruppe.map((e) => e.lat);
      const rand = 0.0015;
      const nah = sonst.filter((p) => p.lng >= Math.min(...xs) - rand && p.lng <= Math.max(...xs) + rand && p.lat >= Math.min(...ys) - rand && p.lat <= Math.max(...ys) + rand);
      return [...nah, ...gruppe.map((e) => standPunkt(e, true))];
    });
  }, [boecke, sonst, zu]); // eslint-disable-line react-hooks/exhaustive-deps

  const gruppenFuerListe = gruppiert ? nachAnstellern(zu) : [{ ansteller: null as Teilnehmer | null, mitglieder: [...zu].sort((a, b) => a.name.localeCompare(b.name, 'de')) }];
  const ja = (b: boolean | null) => (b ? 'ja' : '–');
  const zeile = (t: Teilnehmer) => (
    <tr key={t.id}>
      <td>{t.name}{t.ist_ansteller ? ' (Ansteller)' : ''}</td>
      <td>{t.anschrift ?? ''}</td>
      <td>{t.telefon ?? ''}</td>
      <td>{t.email}</td>
      <td>{standName(t.zugeordnete_einrichtung_id)}</td>
      <td>{ja(t.hat_hund)}</td>
      <td>{ja(t.hat_hornblaeser)}</td>
      <td>{t.auto_vorhanden ? `ja, ${t.mitfahrplaetze ?? 0} Pl.` : '–'}</td>
      {jagd.schuesseltreiben && <td>{ja(t.schuesseltreiben_teilnahme)}</td>}
      {jagd.hegebeitrag_aktiv && <td style={{ textAlign: 'center' }}><Haken an={false} /></td>}
      {jagd.schuesseltreiben && <td style={{ textAlign: 'center' }}><Haken an={false} /></td>}
      <td style={{ textAlign: 'center' }}><Haken an={false} /></td>
    </tr>
  );
  const spalten = 9 + (jagd.hegebeitrag_aktiv ? 1 : 0) + (jagd.schuesseltreiben ? 2 : 0);
  const gesamtZaehler = { zu: zu.length, hunde: zu.filter((t) => t.hat_hund).length, horn: zu.filter((t) => t.hat_hornblaeser).length };
  const ansteller = zu.filter((t) => t.ist_ansteller);

  return (
    <Druckrahmen
      querformat
      onZu={onZu}
      leiste={
        <>
          <label><input type="checkbox" checked={detail} onChange={(e) => setDetail(e.target.checked)} /> Detailkarten</label>
          <label><input type="checkbox" checked={anhang} onChange={(e) => setAnhang(e.target.checked)} /> Anstellerlisten als Anhang</label>
          {strecke.length > 0 && <label><input type="checkbox" checked={mitStrecke} onChange={(e) => setMitStrecke(e.target.checked)} /> Streckenliste</label>}
        </>
      }
    >
      <section className="bj-druck-seite quer">
        <h1>Jagdtag-Mappe · {jagd.titel}</h1>
        <p className="art">{jagd.art} · {zeitText(jagd)}</p>
        <table className="bj-druck-tabelle">
          <tbody>
            {hatTp && <tr><th>Treffpunkt</th><td>{adresse ? `${adresse} · ` : ''}<small>{jagd.treffpunkt_lat!.toFixed(5)}, {jagd.treffpunkt_lng!.toFixed(5)}</small></td></tr>}
            <tr>
              <th>Jagdleitung</th>
              <td>
                {leitung.length === 0 ? '–' : leitung.map((l, i) => (
                  <span key={i}>{i > 0 && <br />}<strong>{l.name}</strong>{l.funktion ? ` (${l.funktion})` : ''}{tel(l.telefon)}</span>
                ))}
              </td>
            </tr>
            <tr><th>Teilnehmer</th><td>{gesamtZaehler.zu} Zusagen · {gesamtZaehler.hunde} Hunde · {gesamtZaehler.horn} Hornbläser</td></tr>
          </tbody>
        </table>
        {jagd.info_jagdleitung && (
          <>
            <h2 className="klein">Infos für die Jagdleitung</h2>
            <div className="bj-druck-kasten">{jagd.info_jagdleitung}</div>
          </>
        )}
        <h2 className="klein">Teilnehmer{gruppiert ? ' nach Anstellergruppen' : ''}</h2>
        <table className="bj-druck-liste">
          <thead>
            <tr>
              <th>Name</th><th>Anschrift</th><th>Telefon</th><th>E-Mail</th><th>Stand</th><th>Hund</th><th>Horn</th><th>Auto</th>
              {jagd.schuesseltreiben && <th>Schüsseltr.</th>}
              {jagd.hegebeitrag_aktiv && <th>Hege bezahlt</th>}
              {jagd.schuesseltreiben && <th>Schüsseltr. teilgen.</th>}
              <th>bei Ansprache da</th>
            </tr>
          </thead>
          <tbody>
            {gruppenFuerListe.map((g) => (
              <Fragment key={g.ansteller?.id ?? 'ohne'}>
                {gruppiert && (
                  <tr className="gruppe">
                    <td colSpan={spalten + 1}>{g.ansteller ? `Gruppe ${g.ansteller.name}${g.ansteller.telefon ? ` · Tel. ${g.ansteller.telefon}` : ''}` : 'Ohne Gruppe'}</td>
                  </tr>
                )}
                {g.ansteller && zeile(g.ansteller)}
                {g.mitglieder.map((t) => zeile(t))}
              </Fragment>
            ))}
          </tbody>
        </table>
        <small className="art">Leere Kästchen zum Abhaken vor Ort; gespeicherte Angaben erscheinen angehakt.</small>
      </section>

      {(uebersicht.length > 0) && (
        <section className="bj-druck-seite quer">
          <h1 style={{ fontSize: '1.2rem' }}>Übersichtskarte · {jagd.titel}</h1>
          <DruckKarte punkte={uebersicht} breiteMm={273} hoeheMm={158} mindestBreiteM={800} pflichtLabels={false} alt="Übersichtskarte aller Stände" />
        </section>
      )}

      {detail &&
        blaetter.map((punkte, i) => (
          <section className="bj-druck-seite quer" key={i}>
            <h1 style={{ fontSize: '1.2rem' }}>Detailkarte {i + 1} von {blaetter.length} · {jagd.titel}</h1>
            <DruckKarte punkte={punkte} breiteMm={273} hoeheMm={158} mindestBreiteM={450} pflichtLabels alt={`Detailkarte ${i + 1}`} />
          </section>
        ))}

      {anhang &&
        ansteller.map((a) => {
          const gruppe = zu.filter((t) => t.ansteller_id === a.id).sort((x, y) => x.name.localeCompare(y.name, 'de'));
          const uebrige = zu.filter((t) => t.id !== a.id && t.ansteller_id !== a.id).sort((x, y) => x.name.localeCompare(y.name, 'de'));
          const kurz = (t: Teilnehmer) => (
            <tr key={t.id}>
              <td>{t.name}</td>
              <td>{standName(t.zugeordnete_einrichtung_id)}</td>
              <td>{t.telefon ?? ''}</td>
            </tr>
          );
          return (
            <section className="bj-druck-seite quer" key={a.id}>
              <h1 style={{ fontSize: '1.3rem' }}>Anstellerliste · {a.name}</h1>
              <p className="art">{jagd.titel} · {zeitText(jagd)}{a.telefon ? ` · Tel. ${a.telefon}` : ''}</p>
              <table className="bj-druck-liste">
                <thead><tr><th>Name</th><th>Stand</th><th>Telefon</th></tr></thead>
                <tbody>
                  <tr className="gruppe"><td colSpan={3}>Deine Gruppe</td></tr>
                  {kurz(a)}
                  {gruppe.map(kurz)}
                  {uebrige.length > 0 && <tr className="gruppe"><td colSpan={3}>Übrige Teilnehmer</td></tr>}
                  {uebrige.map(kurz)}
                </tbody>
              </table>
            </section>
          );
        })}
      {mitStrecke && strecke.length > 0 && (
        <section className="bj-druck-seite quer">
          <h1 style={{ fontSize: '1.3rem' }}>Strecke · {jagd.titel}</h1>
          <p className="art">{jagd.art} · {zeitText(jagd)} · {strecke.length} Stück</p>
          <table className="bj-druck-liste">
            <thead><tr><th>Wildart</th><th>Geschlecht</th><th>Alter</th><th>Stand</th><th>Erleger</th><th>Uhr</th><th>Gewicht</th></tr></thead>
            <tbody>
              {[...new Set(strecke.map((r) => r.wildart))].sort((a, b) => a.localeCompare(b, 'de')).flatMap((w) => {
                const rows = strecke.filter((r) => r.wildart === w);
                return [
                  <tr className="gruppe" key={`g${w}`}><td colSpan={7}>{w}: {rows.length} Stück</td></tr>,
                  ...rows.map((r, i) => (
                    <tr key={`${w}${i}`}>
                      <td>{r.wildart}</td><td>{r.geschlecht}</td><td>{r.altersklasse ?? ''}</td><td>{r.stand}</td><td>{r.erleger}</td><td>{r.uhr}</td>
                      <td>{r.gewicht ? `${r.gewicht.toLocaleString('de-DE')} kg` : ''}</td>
                    </tr>
                  )),
                ];
              })}
            </tbody>
            <tfoot><tr><td colSpan={7}><strong>Summe: {strecke.length} Stück</strong></td></tr></tfoot>
          </table>
        </section>
      )}
    </Druckrahmen>
  );
}
