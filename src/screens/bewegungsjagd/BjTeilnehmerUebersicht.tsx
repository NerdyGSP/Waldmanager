import { Fragment, useMemo, useState } from 'react';
import { useBreit } from '../../lib/useBreit';
import { codeAnzeigen } from '../../lib/bewegungsjagd';
import { nachAnstellern } from '../../lib/bjGruppen';
import type { Tables } from '../../lib/database.types';
import { Knopf, Leer } from '../../components/ui';

type Teilnehmer = Tables<'bewegungsjagd_teilnehmer'>;
type Stand = { id: string; label: string };
type StatusFilter = 'alle' | 'eingeladen' | 'zugesagt' | 'abgesagt';
type Spalte = 'name' | 'status' | 'stand' | 'telefon' | 'hund' | 'horn' | 'auto' | 'schuessel' | 'mail';

const STATUSTEXT: Record<string, string> = { eingeladen: 'offen', zugesagt: 'zugesagt', abgesagt: 'abgesagt' };
const badge = (status: string) => `badge ${status === 'zugesagt' ? 'badge-gruen' : status === 'abgesagt' ? 'badge-rot' : ''}`;
const ja = (b: boolean | null) => (b ? 'ja' : '–');
const mailText = (t: Teilnehmer) => (t.mail_status ? (t.mail_status === 'gesendet' ? 'gesendet' : `Fehler${t.mail_fehler ? ` (${t.mail_fehler})` : ''}`) : '–');

// Wert je Spalte für die Sortierung
function sortWert(t: Teilnehmer, s: Spalte, standName: (id: string | null) => string): string | number {
  switch (s) {
    case 'name': return t.name.toLocaleLowerCase('de');
    case 'status': return t.status;
    case 'stand': return standName(t.zugeordnete_einrichtung_id).toLocaleLowerCase('de');
    case 'telefon': return t.telefon ?? '';
    case 'hund': return t.hat_hund ? 1 : 0;
    case 'horn': return t.hat_hornblaeser ? 1 : 0;
    case 'auto': return t.auto_vorhanden ? t.mitfahrplaetze ?? 0 : -1;
    case 'schuessel': return t.schuesseltreiben_teilnahme ? 1 : 0;
    case 'mail': return t.mail_status ?? '';
  }
}

// Teilnehmerübersicht der Jagdverwaltung: Zähler, Suche, Filter, sortierbare Tabelle (ab 900 px) bzw. Karten, Gruppen je Ansteller
export function BjTeilnehmerUebersicht({
  tn,
  offen,
  schuesseltreiben,
  staende,
  standName,
  sendet,
  onAendern,
  onEntfernen,
  onErneutEinladen,
  onStandPerKarte,
}: {
  tn: Teilnehmer[];
  offen: boolean;
  schuesseltreiben: boolean;
  staende: Stand[];
  standName: (id: string | null) => string;
  sendet: boolean;
  onAendern: (t: Teilnehmer, felder: Partial<Teilnehmer>) => Promise<void>;
  onEntfernen: (t: Teilnehmer) => Promise<void>;
  onErneutEinladen: (t: Teilnehmer) => Promise<void>;
  onStandPerKarte: (t: Teilnehmer) => void;
}) {
  const breit = useBreit();
  const [suche, setSuche] = useState('');
  const [status, setStatus] = useState<StatusFilter>('alle');
  const [anstellerFilter, setAnstellerFilter] = useState(''); // '' = alle, 'ohne' = ohne Gruppe, sonst Ansteller-ID
  const [sortSpalte, setSortSpalte] = useState<Spalte | null>(null);
  const [sortRichtung, setSortRichtung] = useState<1 | -1>(1);
  const [zugeklappt, setZugeklappt] = useState<Set<string>>(new Set());
  const [offenZeile, setOffenZeile] = useState<string | null>(null);

  const anstellerListe = tn.filter((t) => t.ist_ansteller && t.aktiv);

  const sichtbar = useMemo(() => {
    const q = suche.trim().toLocaleLowerCase('de');
    const ids = new Set(tn.filter((t) => t.ist_ansteller).map((t) => t.id));
    return tn.filter((t) => {
      if (status !== 'alle' && t.status !== status) return false;
      if (q && ![t.name, t.email, t.telefon ?? '', t.anschrift ?? ''].some((x) => x.toLocaleLowerCase('de').includes(q))) return false;
      if (anstellerFilter) {
        const gruppe = t.ist_ansteller ? t.id : t.ansteller_id && ids.has(t.ansteller_id) ? t.ansteller_id : 'ohne';
        if (gruppe !== anstellerFilter) return false;
      }
      return true;
    });
  }, [tn, suche, status, anstellerFilter]);

  const gruppen = useMemo(() => {
    const g = nachAnstellern(sichtbar);
    if (!sortSpalte) return g;
    const vergleich = (a: Teilnehmer, b: Teilnehmer) => {
      const x = sortWert(a, sortSpalte, standName);
      const y = sortWert(b, sortSpalte, standName);
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'de');
      return (r || a.name.localeCompare(b.name, 'de')) * sortRichtung;
    };
    return g.map((gr) => ({ ...gr, mitglieder: [...gr.mitglieder].sort(vergleich) }));
  }, [sichtbar, sortSpalte, sortRichtung, standName]);

  const sortieren = (s: Spalte) => {
    if (sortSpalte === s) setSortRichtung((r) => (r === 1 ? -1 : 1));
    else {
      setSortSpalte(s);
      setSortRichtung(1);
    }
  };
  const kopf = (s: Spalte, text: string) => (
    <th scope="col" aria-sort={sortSpalte === s ? (sortRichtung === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="link" onClick={() => sortieren(s)}>
        {text}
        {sortSpalte === s ? (sortRichtung === 1 ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  );
  const umschalten = (key: string) => setZugeklappt((alt) => {
    const n = new Set(alt);
    if (n.has(key)) n.delete(key);
    else n.add(key);
    return n;
  });

  const standAuswahl = (t: Teilnehmer) =>
    offen ? (
      <select aria-label={`Stand für ${t.name}`} value={t.zugeordnete_einrichtung_id ?? ''} onChange={(e) => void onAendern(t, { zugeordnete_einrichtung_id: e.target.value || null })}>
        <option value="">– kein Stand –</option>
        {staende.map((e) => (
          <option key={e.id} value={e.id}>
            {e.label}
          </option>
        ))}
      </select>
    ) : (
      standName(t.zugeordnete_einrichtung_id) || '–'
    );
  const anstellerAuswahl = (t: Teilnehmer) =>
    offen && !t.ist_ansteller && anstellerListe.length > 0 ? (
      <select aria-label={`Ansteller für ${t.name}`} value={t.ansteller_id ?? ''} onChange={(e) => void onAendern(t, { ansteller_id: e.target.value || null })}>
        <option value="">– ohne Ansteller –</option>
        {anstellerListe.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    ) : null;
  const aktionen = (t: Teilnehmer) =>
    offen ? (
      <span className="bj-zeile-aktionen">
        {anstellerAuswahl(t)}
        <Knopf variante="ghost" onClick={() => void onAendern(t, { aktiv: !t.aktiv })}>
          {t.aktiv ? 'Deaktivieren' : 'Aktivieren'}
        </Knopf>
        <Knopf variante="gefahr" onClick={() => void onEntfernen(t)}>
          Löschen
        </Knopf>
      </span>
    ) : null;
  const detail = (t: Teilnehmer) => (
    <div className="bj-detail">
      <div>
        <strong>E-Mail:</strong> {t.email}
      </div>
      {t.anschrift && (
        <div>
          <strong>Anschrift:</strong> {t.anschrift}
        </div>
      )}
      <div>
        <strong>Code:</strong> {codeAnzeigen(t.einladungscode)}
      </div>
      {offen && (
        <div className="bj-zeile-aktionen" style={{ justifyContent: 'flex-start' }}>
          <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            <input type="checkbox" checked={t.ist_ansteller} onChange={(e) => void onAendern(t, { ist_ansteller: e.target.checked })} /> Ansteller
          </label>
          <Knopf variante="ghost" onClick={() => onStandPerKarte(t)}>
            Stand per Karte
          </Knopf>
          {t.aktiv && t.status === 'eingeladen' && (
            <Knopf variante="ghost" disabled={sendet} onClick={() => void onErneutEinladen(t)}>
              Erneut einladen
            </Knopf>
          )}
        </div>
      )}
    </div>
  );

  const spaltenAnzahl = 9 + (schuesseltreiben ? 1 : 0);
  const gruppenKopf = (g: { ansteller: Teilnehmer | null; mitglieder: Teilnehmer[] }) => {
    const key = g.ansteller?.id ?? 'ohne';
    const zu = zugeklappt.has(key);
    const anzahl = g.mitglieder.length + (g.ansteller ? 1 : 0);
    return { key, zu, anzahl, text: g.ansteller ? `Gruppe von ${g.ansteller.name} (${anzahl})` : `Ohne Gruppe (${anzahl})` };
  };
  const tabellenZeile = (t: Teilnehmer, eingerueckt: boolean) => (
    <Fragment key={t.id}>
      <tr className={t.aktiv ? '' : 'inaktiv'}>
        <th scope="row" style={{ paddingLeft: eingerueckt ? 24 : undefined }}>
          <button type="button" className="link" aria-expanded={offenZeile === t.id} onClick={() => setOffenZeile(offenZeile === t.id ? null : t.id)}>
            {offenZeile === t.id ? '▾' : '▸'} {t.name}
          </button>
          {t.ist_ansteller && <span className="badge"> Ansteller</span>}
        </th>
        <td>
          <span className={badge(t.status)}>{STATUSTEXT[t.status] ?? t.status}</span>
        </td>
        <td>{standAuswahl(t)}</td>
        <td>{t.telefon ?? '–'}</td>
        <td>{ja(t.hat_hund)}</td>
        <td>{ja(t.hat_hornblaeser)}</td>
        <td>{t.auto_vorhanden ? `ja, ${t.mitfahrplaetze ?? 0} Pl.` : '–'}</td>
        {schuesseltreiben && <td>{ja(t.schuesseltreiben_teilnahme)}</td>}
        <td>{mailText(t)}</td>
        <td>
          {offen && (
            <details className="bj-menue">
              <summary aria-label={`Aktionen für ${t.name}`}>⋯</summary>
              <div className="bj-menue-inhalt">{aktionen(t)}</div>
            </details>
          )}
        </td>
      </tr>
      {offenZeile === t.id && (
        <tr>
          <td colSpan={spaltenAnzahl}>{detail(t)}</td>
        </tr>
      )}
    </Fragment>
  );
  const karte = (t: Teilnehmer, eingerueckt: boolean) => (
    <div key={t.id} className={`bj-zeile ${t.aktiv ? '' : 'inaktiv'} ${eingerueckt ? 'im-gruppe' : ''}`}>
      <span>
        <strong>{t.name}</strong> <span className={badge(t.status)}>{STATUSTEXT[t.status] ?? t.status}</span>
        {t.ist_ansteller && <span className="badge"> Ansteller</span>}
        <br />
        <small>
          {t.telefon ? `${t.telefon} · ` : ''}Stand: {standName(t.zugeordnete_einrichtung_id) || '–'}
          {t.status === 'zugesagt' && ` · ${[t.hat_hund && 'Hund', t.hat_hornblaeser && 'Hornbläser', t.auto_vorhanden && `Auto, ${t.mitfahrplaetze ?? 0} Pl.`, schuesseltreiben && t.schuesseltreiben_teilnahme && 'Schüsseltreiben'].filter(Boolean).join(', ') || 'keine Angaben'}`}
          {t.mail_status ? ` · Mail ${mailText(t)}` : ''}
        </small>
        <br />
        <button type="button" className="link" aria-expanded={offenZeile === t.id} onClick={() => setOffenZeile(offenZeile === t.id ? null : t.id)}>
          {offenZeile === t.id ? 'Weniger' : 'Details & Aktionen'}
        </button>
        {offenZeile === t.id && (
          <>
            {detail(t)}
            {offen && (
              <div className="bj-zeile-aktionen" style={{ justifyContent: 'flex-start', marginTop: 6 }}>
                {standAuswahl(t)}
                {aktionen(t)}
              </div>
            )}
          </>
        )}
      </span>
    </div>
  );

  return (
    <>
      <div className="bj-filter" style={{ padding: '10px var(--abstand)' }}>
        <input type="search" placeholder="Suchen (Name, E-Mail, Telefon)" aria-label="Teilnehmer suchen" value={suche} onChange={(e) => setSuche(e.target.value)} />
        <select aria-label="Status filtern" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          <option value="alle">Alle Status</option>
          <option value="eingeladen">Offen</option>
          <option value="zugesagt">Zugesagt</option>
          <option value="abgesagt">Abgesagt</option>
        </select>
        {anstellerListe.length > 0 && (
          <select aria-label="Nach Ansteller filtern" value={anstellerFilter} onChange={(e) => setAnstellerFilter(e.target.value)}>
            <option value="">Alle Gruppen</option>
            {anstellerListe.map((a) => (
              <option key={a.id} value={a.id}>
                Gruppe {a.name}
              </option>
            ))}
            <option value="ohne">Ohne Gruppe</option>
          </select>
        )}
      </div>
      {sichtbar.length === 0 && <Leer>Keine Teilnehmer in dieser Ansicht.</Leer>}
      {sichtbar.length > 0 && breit && (
        <div className="tabelle-rahmen" style={{ border: 0, overflowX: 'auto' }}>
          <table className="tabelle bj-tn-tabelle">
            <thead>
              <tr>
                {kopf('name', 'Name')}
                {kopf('status', 'Status')}
                {kopf('stand', 'Stand')}
                {kopf('telefon', 'Telefon')}
                {kopf('hund', 'Hund')}
                {kopf('horn', 'Hornbläser')}
                {kopf('auto', 'Auto/Plätze')}
                {schuesseltreiben && kopf('schuessel', 'Schüsseltreiben')}
                {kopf('mail', 'Mail')}
                <th scope="col">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {gruppen.map((g) => {
                const { key, zu, text } = gruppenKopf(g);
                return (
                  <Fragment key={key}>
                    <tr className="bj-gruppe-zeile">
                      <td colSpan={spaltenAnzahl}>
                        <button type="button" className="link" aria-expanded={!zu} onClick={() => umschalten(key)}>
                          {zu ? '▸' : '▾'} {text}
                        </button>
                      </td>
                    </tr>
                    {!zu && (
                      <>
                        {g.ansteller && tabellenZeile(g.ansteller, false)}
                        {g.mitglieder.map((t) => tabellenZeile(t, true))}
                      </>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {sichtbar.length > 0 && !breit &&
        gruppen.map((g) => {
          const { key, zu, text } = gruppenKopf(g);
          return (
            <div key={key}>
              <div className="bj-gruppe-kopf">
                <button onClick={() => umschalten(key)} aria-expanded={!zu}>
                  {zu ? '▸' : '▾'} {text}
                </button>
              </div>
              {!zu && (
                <>
                  {g.ansteller && karte(g.ansteller, false)}
                  {g.mitglieder.map((t) => karte(t, true))}
                </>
              )}
            </div>
          );
        })}
    </>
  );
}
