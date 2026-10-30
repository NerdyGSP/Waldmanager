import { AuditZeile } from '../../components/AuditZeile';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { useWildarten, useZonen, wildartName } from '../../lib/stammdaten';
import { aktuellesJagdjahr, datumDE, heuteISO, letzteJagdjahre } from '../../lib/zeit';
import { aktuellePosition, punktEWKT } from '../../lib/geo';
import type { Tables } from '../../lib/database.types';
import { Auswahl, Feld, Gruppe, Hinweis, Knopf, Leer, Seite, Zeile, WildartOptionen } from '../../components/ui';
import type { RevierKontext } from './kontext';

type Schaden = Pick<
  Tables<'wildschaeden'>,
  'id' | 'kenntnis_am' | 'angemeldet_am' | 'status' | 'kultur' | 'flaeche_ha' | 'wildart_id' | 'zone_id' | 'ort' | 'geschaedigter' | 'kontakt' | 'schaden_eur' | 'bemerkung' | 'erfasst_von'
>;

const STATUS: Array<{ wert: string; label: string }> = [
  { wert: 'erfasst', label: 'Erfasst' },
  { wert: 'angemeldet', label: 'Angemeldet' },
  { wert: 'besichtigt', label: 'Besichtigt' },
  { wert: 'reguliert', label: 'Reguliert' },
  { wert: 'abgelehnt', label: 'Abgelehnt' },
];
const KULTUREN = ['Mais', 'Weizen', 'Gerste', 'Roggen', 'Raps', 'Zuckerrüben', 'Kartoffeln', 'Grünland', 'Wiese', 'Obst/Sonderkultur', 'Forst/Verjüngung', 'Sonstiges'];

const TAG = 86400000;
const tageSeit = (iso: string) => {
  const [j, m, t] = iso.split('-').map(Number) as [number, number, number];
  const heute = new Date();
  return Math.round((Date.UTC(heute.getFullYear(), heute.getMonth(), heute.getDate()) - Date.UTC(j, m - 1, t)) / TAG);
};
const plusTage = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Anmeldefrist: eine Woche ab Kenntnis (§ 34 BJagdG) */
export function fristStand(s: Pick<Schaden, 'kenntnis_am' | 'angemeldet_am' | 'status'>): { art: 'ok' | 'bald' | 'heute' | 'abgelaufen' | 'spaet' | 'offen-aus'; text: string; frist: string } {
  const frist = plusTage(s.kenntnis_am, 7);
  if (s.angemeldet_am || s.status !== 'erfasst') {
    const a = s.angemeldet_am;
    if (a && a > frist) return { art: 'spaet', text: `verspätet angemeldet (${datumDE(a)})`, frist };
    return { art: 'ok', text: a ? `fristgerecht angemeldet (${datumDE(a)})` : 'Anmeldung abgeschlossen', frist };
  }
  const rest = -tageSeit(frist);
  if (rest < 0) return { art: 'abgelaufen', text: `Frist seit ${-rest} ${-rest === 1 ? 'Tag' : 'Tagen'} abgelaufen`, frist };
  if (rest === 0) return { art: 'heute', text: 'Heute letzter Tag der Anmeldefrist', frist };
  return { art: rest <= 2 ? 'bald' : 'offen-aus', text: `Anmeldung bis ${datumDE(frist)} (noch ${rest} ${rest === 1 ? 'Tag' : 'Tage'})`, frist };
}

function FristBadge({ s }: { s: Schaden }) {
  const f = fristStand(s);
  const klasse = f.art === 'ok' ? 'badge-gruen' : f.art === 'offen-aus' ? '' : f.art === 'bald' || f.art === 'heute' ? 'badge-orange' : 'badge-rot';
  return <span className={`badge ${klasse}`}>{f.text}</span>;
}

export function Wildschaeden({ k }: { k: RevierKontext }) {
  const wildarten = useWildarten();
  const { zonen } = useZonen(k.revierId);
  const [jahr, setJahr] = useState(aktuellesJagdjahr());
  const [liste, setListe] = useState<Schaden[]>([]);
  const [offeneFristen, setOffeneFristen] = useState<Schaden[]>([]);
  const [bearbeiten, setBearbeiten] = useState<Schaden | 'neu' | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const spalten = 'id, kenntnis_am, angemeldet_am, status, kultur, flaeche_ha, wildart_id, zone_id, ort, geschaedigter, kontakt, schaden_eur, bemerkung, erfasst_von';
    const [a, b] = await Promise.all([
      supabase
        .from('wildschaeden')
        .select(spalten)
        .eq('revier_id', k.revierId)
        .is('geloescht_am', null)
        .gte('kenntnis_am', jahr.von)
        .lte('kenntnis_am', jahr.bis)
        .order('kenntnis_am', { ascending: false }),
      // Noch nicht angemeldete Schäden, unabhängig vom gewählten Jagdjahr
      supabase
        .from('wildschaeden')
        .select(spalten)
        .eq('revier_id', k.revierId)
        .is('geloescht_am', null)
        .eq('status', 'erfasst')
        .is('angemeldet_am', null)
        .order('kenntnis_am'),
    ]);
    const err = a.error ?? b.error;
    if (err) setFehler(fehlertext(err));
    setListe(a.data ?? []);
    setOffeneFristen(b.data ?? []);
  }, [k.revierId, jahr]);

  useEffect(() => {
    void laden();
  }, [laden]);

  const summe = useMemo(
    () => ({
      flaeche: liste.reduce((a, s) => a + (s.flaeche_ha ?? 0), 0),
      eur: liste.reduce((a, s) => a + (s.schaden_eur ?? 0), 0),
    }),
    [liste],
  );
  const dringend = offeneFristen.filter((s) => ['bald', 'heute', 'abgelaufen'].includes(fristStand(s).art));

  if (bearbeiten) {
    return (
      <SchadenFormular
        k={k}
        vorlage={bearbeiten === 'neu' ? null : bearbeiten}
        onFertig={async () => {
          setBearbeiten(null);
          await laden();
        }}
      />
    );
  }

  return (
    <Seite
      titel="Wildschäden"
      untertitel={`Jagdjahr ${jahr.label} · ${liste.length} ${liste.length === 1 ? 'Meldung' : 'Meldungen'}`}
      aktion={<Knopf variante="akzent" onClick={() => setBearbeiten('neu')}>+ Schaden</Knopf>}
    >
      <Hinweis>
        <strong>Anmeldefrist: eine Woche.</strong> Ein Wildschaden muss innerhalb einer Woche, nachdem der Geschädigte davon Kenntnis
        erhalten hat (oder hätte erhalten müssen), bei der zuständigen Stelle angemeldet werden (§ 34 BJagdG). Für forstliche Flächen
        genügt eine Sammelmeldung zum 1. Mai und 1. Oktober. Landesrecht und Pachtvertrag können abweichen.
      </Hinweis>

      {dringend.length > 0 && (
        <div className="hinweis frist" role="alert">
          <strong>Frist beachten:</strong>
          <ul className="frist-liste">
            {dringend.map((s) => (
              <li key={s.id}>
                <button className="link" onClick={() => setBearbeiten(s)}>
                  {s.kultur}
                  {s.geschaedigter ? ` · ${s.geschaedigter}` : ''}
                </button>{' '}
                – {fristStand(s).text}
              </li>
            ))}
          </ul>
        </div>
      )}

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

      {liste.length > 0 && (
        <div className="kennzahlen">
          <div className="kennzahl">
            <strong>{liste.length}</strong>
            <span>Meldungen</span>
          </div>
          <div className="kennzahl">
            <strong>{summe.flaeche.toLocaleString('de-DE', { maximumFractionDigits: 2 })}</strong>
            <span>Fläche in ha</span>
          </div>
          <div className="kennzahl">
            <strong>{summe.eur.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</strong>
            <span>geschätzter Schaden</span>
          </div>
        </div>
      )}

      <Gruppe titel="Meldungen">
        {liste.length === 0 && <Zeile label="Keine Wildschäden in diesem Jagdjahr" />}
        {liste.map((s) => (
          <button key={s.id} className="zeile zeile-knopf" onClick={() => setBearbeiten(s)}>
            <span className="zeile-label">
              {s.kultur}
              {s.wildart_id ? ` · ${wildartName(wildarten, s.wildart_id)}` : ''}
              <small>
                {datumDE(s.kenntnis_am)}
                {s.geschaedigter ? ` · ${s.geschaedigter}` : ''}
                {s.flaeche_ha ? ` · ${s.flaeche_ha.toLocaleString('de-DE')} ha` : ''}
                {s.zone_id ? ` · ${zonen.find((z) => z.id === s.zone_id)?.name ?? ''}` : ''}
              </small>
              <span className="zeile-badges">
                <span className="badge">{STATUS.find((x) => x.wert === s.status)?.label}</span>
                <FristBadge s={s} />
              </span>
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

function SchadenFormular({ k, vorlage, onFertig }: { k: RevierKontext; vorlage: Schaden | null; onFertig: () => Promise<void> }) {
  const wildarten = useWildarten();
  const { zonen } = useZonen(k.revierId);
  const [kenntnis, setKenntnis] = useState(vorlage?.kenntnis_am ?? heuteISO());
  const [angemeldet, setAngemeldet] = useState(vorlage?.angemeldet_am ?? '');
  const [status, setStatus] = useState(vorlage?.status ?? 'erfasst');
  const [kultur, setKultur] = useState(vorlage?.kultur ?? 'Mais');
  const [flaeche, setFlaeche] = useState(vorlage?.flaeche_ha ? String(vorlage.flaeche_ha).replace('.', ',') : '');
  const [wildart, setWildart] = useState(vorlage?.wildart_id ?? '');
  const [zoneId, setZoneId] = useState(vorlage?.zone_id ?? '');
  const [ort, setOrt] = useState(vorlage?.ort ?? '');
  const [geschaedigter, setGeschaedigter] = useState(vorlage?.geschaedigter ?? '');
  const [kontakt, setKontakt] = useState(vorlage?.kontakt ?? '');
  const [eur, setEur] = useState(vorlage?.schaden_eur ? String(vorlage.schaden_eur).replace('.', ',') : '');
  const [bemerkung, setBemerkung] = useState(vorlage?.bemerkung ?? '');
  const [position, setPosition] = useState<{ lon: number; lat: number } | null>(null);
  const [ortStatus, setOrtStatus] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [speichert, setSpeichert] = useState(false);

  const frist = fristStand({ kenntnis_am: kenntnis, angemeldet_am: angemeldet || null, status });
  const darfAendern = !vorlage || k.istInhaber || vorlage.erfasst_von === k.userId;

  const zahl = (s: string) => (s.trim() ? Number(s.replace(',', '.')) : null);

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
    const ha = zahl(flaeche);
    const betrag = zahl(eur);
    if ((ha !== null && (!Number.isFinite(ha) || ha < 0)) || (betrag !== null && (!Number.isFinite(betrag) || betrag < 0))) {
      setFehler('Bitte gültige Zahlen für Fläche und Schaden angeben.');
      return;
    }
    setSpeichert(true);
    const daten = {
      revier_id: k.revierId,
      kenntnis_am: kenntnis,
      angemeldet_am: angemeldet || null,
      status: status === 'erfasst' && angemeldet ? 'angemeldet' : status,
      kultur: kultur.trim(),
      flaeche_ha: ha,
      wildart_id: wildart || null,
      zone_id: zoneId || null,
      ort: ort.trim() || null,
      geschaedigter: geschaedigter.trim() || null,
      kontakt: kontakt.trim() || null,
      schaden_eur: betrag,
      bemerkung: bemerkung.trim() || null,
      ...(position ? { geom: punktEWKT(position.lon, position.lat) } : {}),
    };
    const { error } = vorlage
      ? await supabase.from('wildschaeden').update(daten).eq('id', vorlage.id)
      : await supabase.from('wildschaeden').insert(daten);
    setSpeichert(false);
    if (error) setFehler(fehlertext(error));
    else await onFertig();
  }

  async function loeschen() {
    if (!vorlage || !window.confirm('Diese Schadensmeldung löschen?')) return;
    const { error } = await supabase.from('wildschaeden').update({ geloescht_am: new Date().toISOString() }).eq('id', vorlage.id);
    if (error) setFehler(fehlertext(error));
    else await onFertig();
  }

  return (
    <Seite titel={vorlage ? 'Wildschaden bearbeiten' : 'Wildschaden erfassen'} zurueck={() => void onFertig()}>
      {vorlage && <AuditZeile tabelle="wildschaeden" id={vorlage.id} />}
      <form onSubmit={speichern}>
        <div className={`hinweis ${['abgelaufen', 'spaet'].includes(frist.art) ? 'hinweis-fehler' : ['heute', 'bald'].includes(frist.art) ? 'frist' : ''}`} role="status">
          <strong>Anmeldefrist 1 Woche:</strong> {frist.text}
          {!angemeldet && status === 'erfasst' && frist.art === 'offen-aus' && <> – danach nicht mehr fristgerecht.</>}
        </div>

        <Gruppe titel="Schaden">
          <Auswahl label="Kultur" value={KULTUREN.includes(kultur) ? kultur : 'Sonstiges'} onChange={(e) => setKultur(e.target.value)}>
            {KULTUREN.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Auswahl>
          <Feld label="Kenntnis am" type="date" required value={kenntnis} max={heuteISO()} onChange={(e) => setKenntnis(e.target.value)} />
          <Feld label="Fläche (ha)" inputMode="decimal" placeholder="optional" value={flaeche} onChange={(e) => setFlaeche(e.target.value)} />
          <Auswahl label="Verursacher (vermutet)" value={wildart} onChange={(e) => setWildart(e.target.value)}>
            <option value="">unbekannt</option>
            <WildartOptionen wildarten={wildarten} />
          </Auswahl>
          <Feld label="Schaden (€)" inputMode="decimal" placeholder="geschätzt, optional" value={eur} onChange={(e) => setEur(e.target.value)} />
        </Gruppe>

        <Gruppe titel="Ort">
          <Auswahl label="Zone" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">–</option>
            {zonen.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </Auswahl>
          <Feld label="Flurstück / Lage" placeholder="optional" value={ort} onChange={(e) => setOrt(e.target.value)} />
        </Gruppe>
        <Knopf type="button" variante="sekundaer" onClick={ortUebernehmen}>
          📍 Aktuelle Position übernehmen
        </Knopf>
        {ortStatus && <Leer>{ortStatus}</Leer>}

        <Gruppe titel="Geschädigter">
          <Feld label="Name" placeholder="Landwirt / Eigentümer" value={geschaedigter} onChange={(e) => setGeschaedigter(e.target.value)} />
          <Feld label="Kontakt" placeholder="Telefon oder E-Mail" value={kontakt} onChange={(e) => setKontakt(e.target.value)} />
        </Gruppe>

        <Gruppe titel="Bearbeitungsstand">
          <Auswahl label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS.map((s) => (
              <option key={s.wert} value={s.wert}>
                {s.label}
              </option>
            ))}
          </Auswahl>
          <Feld label="Angemeldet am" type="date" value={angemeldet} max={heuteISO()} onChange={(e) => setAngemeldet(e.target.value)} />
          <Feld label="Bemerkung" value={bemerkung} onChange={(e) => setBemerkung(e.target.value)} />
        </Gruppe>

        {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
        {darfAendern ? (
          <Knopf type="submit" disabled={speichert}>
            {speichert ? 'Speichern …' : 'Speichern'}
          </Knopf>
        ) : (
          <Leer>Nur der Revierinhaber und die erfassende Person können diese Meldung ändern.</Leer>
        )}
        <Knopf type="button" variante="ghost" onClick={() => void onFertig()}>
          Abbrechen
        </Knopf>
        {vorlage && k.istInhaber && (
          <Knopf type="button" variante="gefahr" onClick={loeschen}>
            Meldung löschen
          </Knopf>
        )}
      </form>
    </Seite>
  );
}
