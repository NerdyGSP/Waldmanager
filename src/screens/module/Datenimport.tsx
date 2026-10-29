import { useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { csvLesen, datumLesen, geschlechtLesen, normalisieren, textAusDatei, uhrzeitLesen, wildartFinden, zahlLesen } from '../../lib/csv';
import { useWildarten, useZonen, ZONENFARBEN } from '../../lib/stammdaten';
import { datumDE } from '../../lib/zeit';
import type { Enums } from '../../lib/database.types';
import { Gruppe, Hinweis, Knopf, Leer, Seite, Segmente, WildartOptionen } from '../../components/ui';
import { Geoimport } from './Geoimport';
import type { RevierKontext } from './kontext';

type Typ = 'zaehlung' | 'abschuss';
type Feld = { schluessel: string; label: string; pflicht?: boolean; erkennung: RegExp };

const FELDER: Record<Typ, Feld[]> = {
  zaehlung: [
    { schluessel: 'datum', label: 'Datum', pflicht: true, erkennung: /datum|date|tag|zaehldatum/ },
    { schluessel: 'wildart', label: 'Wildart', pflicht: true, erkennung: /wildart|art|tier|wild/ },
    { schluessel: 'anzahl', label: 'Anzahl', pflicht: true, erkennung: /anzahl|stueck|menge|summe|gezaehlt|zahl/ },
    { schluessel: 'zone', label: 'Zone', erkennung: /zone|flaeche|gebiet|bereich|schlag|abteilung/ },
    { schluessel: 'geschlecht', label: 'Geschlecht', erkennung: /geschlecht|sex/ },
    { schluessel: 'altersklasse', label: 'Altersklasse', erkennung: /alter|klasse/ },
    { schluessel: 'bemerkung', label: 'Bemerkung', erkennung: /bemerk|notiz|kommentar|info/ },
  ],
  abschuss: [
    { schluessel: 'datum', label: 'Datum', pflicht: true, erkennung: /datum|date|erlegt|tag|strecke/ },
    { schluessel: 'uhrzeit', label: 'Uhrzeit', erkennung: /uhrzeit|zeit|time/ },
    { schluessel: 'wildart', label: 'Wildart', pflicht: true, erkennung: /wildart|art|tier|wild/ },
    { schluessel: 'geschlecht', label: 'Geschlecht', erkennung: /geschlecht|sex/ },
    { schluessel: 'altersklasse', label: 'Altersklasse', erkennung: /alter|klasse/ },
    { schluessel: 'gewicht', label: 'Gewicht (kg)', erkennung: /gewicht|kg|aufbruch/ },
    { schluessel: 'zone', label: 'Zone', erkennung: /zone|flaeche|gebiet|bereich|revierteil/ },
    { schluessel: 'bemerkung', label: 'Bemerkung', erkennung: /bemerk|notiz|kommentar|info/ },
  ],
};

const VORLAGEN: Record<Typ, string> = {
  zaehlung: 'Datum;Wildart;Anzahl;Zone;Geschlecht;Altersklasse;Bemerkung\n14.03.2021;Rehwild;12;Feldmark Nord;;;Scheinwerferzählung\n14.03.2021;Schwarzwild;4;Feldmark Nord;;;\n',
  abschuss: 'Datum;Uhrzeit;Wildart;Geschlecht;Altersklasse;Gewicht;Zone;Bemerkung\n02.06.2021;05:40;Rehwild;männlich;Jährling;14,5;Feldmark Nord;\n',
};

const MAX_ZEILEN = 20000;

type Zeile = {
  nr: number;
  datum: string;
  stunde: number | null;
  minute: number | null;
  wildartRoh: string;
  anzahl: number;
  geschlecht: Enums<'geschlecht'>;
  altersklasse: string | null;
  gewicht: number | null;
  zoneRoh: string;
  bemerkung: string | null;
};

const lokalISO = (datum: string, stunde: number | null, minute: number | null) => {
  const [j, m, t] = datum.split('-').map(Number) as [number, number, number];
  return new Date(j, m - 1, t, stunde ?? 12, minute ?? 0).toISOString();
};
const stuecke = <T,>(liste: T[], n: number): T[][] => Array.from({ length: Math.ceil(liste.length / n) }, (_, i) => liste.slice(i * n, i * n + n));

export function Datenimport({ k }: { k: RevierKontext }) {
  const wildarten = useWildarten();
  const { zonen, laden: zonenLaden } = useZonen(k.revierId);
  const [bereich, setBereich] = useState<'csv' | 'geo'>('csv');
  const [typ, setTyp] = useState<Typ>('zaehlung');
  const [dateiname, setDateiname] = useState('');
  const [tabelle, setTabelle] = useState<string[][] | null>(null);
  const [zuordnung, setZuordnung] = useState<Record<string, number>>({});
  const [artZuordnung, setArtZuordnung] = useState<Record<string, string>>({});
  const [zonenAnlegen, setZonenAnlegen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const kopf = tabelle?.[0] ?? [];

  function neuStart(t: Typ) {
    setTyp(t);
    setTabelle(null);
    setDateiname('');
    setZuordnung({});
    setArtZuordnung({});
    setFehler(null);
    setMeldung(null);
  }

  async function dateiLesen(datei: File) {
    setFehler(null);
    setMeldung(null);
    try {
      const zeilen = csvLesen(textAusDatei(await datei.arrayBuffer()));
      if (zeilen.length < 2) throw new Error('Die Datei enthält keine Datenzeilen.');
      if (zeilen.length - 1 > MAX_ZEILEN) throw new Error(`Die Datei hat mehr als ${MAX_ZEILEN.toLocaleString('de-DE')} Zeilen – bitte in Teile aufteilen.`);
      setTabelle(zeilen);
      setDateiname(datei.name);
      // Spalten anhand der Überschriften vorschlagen
      const vorschlag: Record<string, number> = {};
      const belegt = new Set<number>();
      for (const f of FELDER[typ]) {
        const i = zeilen[0]!.findIndex((h, idx) => !belegt.has(idx) && f.erkennung.test(normalisieren(h)));
        vorschlag[f.schluessel] = i;
        if (i >= 0) belegt.add(i);
      }
      setZuordnung(vorschlag);
      setArtZuordnung({});
    } catch (err) {
      setTabelle(null);
      setFehler(fehlertext(err));
    }
  }

  const zelle = (z: string[], feld: string) => {
    const i = zuordnung[feld] ?? -1;
    return i >= 0 ? (z[i] ?? '').trim() : '';
  };

  // Zeilen interpretieren
  const auswertung = useMemo(() => {
    const ok: Zeile[] = [];
    const probleme: string[] = [];
    let nullzeilen = 0;
    if (!tabelle) return { ok, probleme, nullzeilen, fehlendePflicht: [] as string[] };
    const fehlendePflicht = FELDER[typ].filter((f) => f.pflicht && (zuordnung[f.schluessel] ?? -1) < 0).map((f) => f.label);
    if (fehlendePflicht.length) return { ok, probleme, nullzeilen, fehlendePflicht };
    for (const [i, z] of tabelle.slice(1).entries()) {
      const nr = i + 2;
      const d = datumLesen(zelle(z, 'datum'));
      if (!d) {
        probleme.push(`Zeile ${nr}: Datum „${zelle(z, 'datum')}“ nicht lesbar`);
        continue;
      }
      const wildartRoh = zelle(z, 'wildart');
      if (!wildartRoh) {
        probleme.push(`Zeile ${nr}: keine Wildart`);
        continue;
      }
      let anzahl = 1;
      if (typ === 'zaehlung') {
        const a = zahlLesen(zelle(z, 'anzahl'));
        if (a === null || a < 0 || !Number.isInteger(a)) {
          probleme.push(`Zeile ${nr}: Anzahl „${zelle(z, 'anzahl')}“ ungültig`);
          continue;
        }
        if (a === 0) {
          nullzeilen++;
          continue;
        }
        anzahl = a;
      }
      const uhr = typ === 'abschuss' ? uhrzeitLesen(zelle(z, 'uhrzeit')) : null;
      const gewicht = typ === 'abschuss' ? zahlLesen(zelle(z, 'gewicht')) : null;
      ok.push({
        nr,
        datum: d.datum,
        stunde: uhr?.stunde ?? d.stunde,
        minute: uhr?.minute ?? d.minute,
        wildartRoh,
        anzahl,
        geschlecht: geschlechtLesen(zelle(z, 'geschlecht')),
        altersklasse: zelle(z, 'altersklasse') || null,
        gewicht: gewicht && gewicht > 0 ? gewicht : null,
        zoneRoh: zelle(z, 'zone'),
        bemerkung: zelle(z, 'bemerkung') || null,
      });
    }
    return { ok, probleme, nullzeilen, fehlendePflicht };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabelle, zuordnung, typ]);

  // Wildart-Werte: automatisch erkannt oder manuell zugeordnet
  const artWerte = useMemo(() => {
    const m = new Map<string, { anzahl: number; id: string | null }>();
    for (const z of auswertung.ok) {
      const e = m.get(z.wildartRoh) ?? { anzahl: 0, id: wildartFinden(z.wildartRoh, wildarten) };
      e.anzahl++;
      m.set(z.wildartRoh, e);
    }
    return [...m.entries()].map(([roh, e]) => ({ roh, anzahl: e.anzahl, auto: e.id }));
  }, [auswertung.ok, wildarten]);

  const artFuer = (roh: string) => artWerte.find((a) => a.roh === roh)?.auto ?? (artZuordnung[roh] || null);
  const offeneArten = artWerte.filter((a) => !a.auto && !artZuordnung[a.roh]);

  const zonenWerte = useMemo(() => {
    const m = new Map<string, number>();
    for (const z of auswertung.ok) if (z.zoneRoh) m.set(z.zoneRoh, (m.get(z.zoneRoh) ?? 0) + 1);
    return [...m.entries()].map(([roh, anzahl]) => ({ roh, anzahl, vorhanden: zonen.some((x) => normalisieren(x.name) === normalisieren(roh)) }));
  }, [auswertung.ok, zonen]);
  const unbekannteZonen = zonenWerte.filter((z) => !z.vorhanden);

  const importierbar = auswertung.ok.filter((z) => artFuer(z.wildartRoh));
  const datumVon = importierbar.reduce((a, z) => (a === '' || z.datum < a ? z.datum : a), '');
  const datumBis = importierbar.reduce((a, z) => (z.datum > a ? z.datum : a), '');

  async function importieren() {
    setLaeuft(true);
    setFehler(null);
    setMeldung(null);
    try {
      // Zonen zuordnen (optional unbekannte neu anlegen)
      const zonenIds = new Map<string, string>(zonen.map((z) => [normalisieren(z.name), z.id]));
      if (zonenAnlegen) {
        const neu = unbekannteZonen.map((z) => z.roh);
        for (const [i, name] of neu.entries()) {
          if (zonenIds.has(normalisieren(name))) continue;
          const { data, error } = await supabase
            .from('zonen')
            .insert({ revier_id: k.revierId, name, sortierung: zonen.length + i, farbe: ZONENFARBEN[(zonen.length + i) % ZONENFARBEN.length] })
            .select('id')
            .single();
          if (error) throw error;
          zonenIds.set(normalisieren(name), data.id);
        }
        await zonenLaden();
      }
      const zoneId = (roh: string) => (roh ? (zonenIds.get(normalisieren(roh)) ?? null) : null);

      if (typ === 'zaehlung') {
        const marke = `CSV-Import ${dateiname}`;
        const nachDatum = new Map<string, Zeile[]>();
        for (const z of importierbar) nachDatum.set(z.datum, [...(nachDatum.get(z.datum) ?? []), z]);
        const { data: vorhanden, error: e0 } = await supabase
          .from('zaehlsitzungen')
          .select('datum')
          .eq('revier_id', k.revierId)
          .eq('bemerkung', marke)
          .is('geloescht_am', null)
          .in('datum', [...nachDatum.keys()]);
        if (e0) throw e0;
        const schonDa = new Set((vorhanden ?? []).map((x) => x.datum));
        const neueTage = [...nachDatum.keys()].filter((d) => !schonDa.has(d)).sort();
        let anzahlZaehlungen = 0;
        for (const tage of stuecke(neueTage, 100)) {
          const { data: sitzungen, error } = await supabase
            .from('zaehlsitzungen')
            .insert(tage.map((datum) => ({ revier_id: k.revierId, datum, status: 'abgeschlossen' as const, bemerkung: marke, erstellt_von: k.userId })))
            .select('id, datum');
          if (error) throw error;
          const zeilen = (sitzungen ?? []).flatMap((s) =>
            (nachDatum.get(s.datum) ?? []).map((z) => ({
              sitzung_id: s.id,
              revier_id: k.revierId,
              wildart_id: artFuer(z.wildartRoh)!,
              anzahl: z.anzahl,
              geschlecht: z.geschlecht,
              altersklasse: z.altersklasse,
              zone_id: zoneId(z.zoneRoh),
              bemerkung: z.bemerkung,
              erfasst_von: k.userId,
            })),
          );
          for (const teil of stuecke(zeilen, 500)) {
            const { error: e2 } = await supabase.from('zaehlungen').insert(teil);
            if (e2) throw e2;
          }
          anzahlZaehlungen += zeilen.length;
        }
        setMeldung(
          `${neueTage.length} Zählungen mit ${anzahlZaehlungen.toLocaleString('de-DE')} Einträgen importiert` +
            (schonDa.size ? `; ${schonDa.size} Tage waren aus dieser Datei bereits importiert und wurden übersprungen` : '') +
            '. Sie erscheinen im Monitoring und in der Historie.',
        );
      } else {
        const { data: vorhanden, error: e0 } = await supabase
          .from('abschuesse')
          .select('wildart_id, erlegt_am, geschlecht')
          .eq('revier_id', k.revierId)
          .is('geloescht_am', null)
          .gte('erlegt_am', `${datumVon}T00:00:00`)
          .lte('erlegt_am', `${datumBis}T23:59:59`)
          .limit(10000);
        if (e0) throw e0;
        const schluessel = (w: string, t: string, g: string) => `${w}|${new Date(t).getTime()}|${g}`;
        const bekannt = new Set((vorhanden ?? []).map((x) => schluessel(x.wildart_id, x.erlegt_am, x.geschlecht)));
        const neu = importierbar
          .map((z) => ({
            revier_id: k.revierId,
            wildart_id: artFuer(z.wildartRoh)!,
            geschlecht: z.geschlecht,
            altersklasse: z.altersklasse,
            erlegt_am: lokalISO(z.datum, z.stunde, z.minute),
            gewicht_kg: z.gewicht,
            zone_id: zoneId(z.zoneRoh),
            bemerkung: z.bemerkung,
            erfasst_von: k.userId,
          }))
          .filter((r) => {
            const s = schluessel(r.wildart_id, r.erlegt_am, r.geschlecht);
            if (bekannt.has(s)) return false;
            bekannt.add(s); // identische Zeilen in der Datei selbst bleiben erhalten, wenn sie nicht schon in der Datenbank sind
            return true;
          });
        for (const teil of stuecke(neu, 300)) {
          const { error } = await supabase.from('abschuesse').insert(teil);
          if (error) throw error;
        }
        const uebersprungen = importierbar.length - neu.length;
        setMeldung(
          `${neu.length} Abschüsse importiert` +
            (uebersprungen ? `; ${uebersprungen} bereits vorhanden bzw. doppelt und übersprungen` : '') +
            '.',
        );
      }
      setTabelle(null);
      setDateiname('');
    } catch (err) {
      setFehler(`Import abgebrochen: ${fehlertext(err)} Bereits übertragene Teile bleiben bestehen; ein erneuter Import überspringt sie.`);
    } finally {
      setLaeuft(false);
    }
  }

  if (!k.istInhaber) {
    return (
      <Seite titel="Datenimport">
        <Hinweis>Historische Daten kann nur der Revierinhaber importieren.</Hinweis>
      </Seite>
    );
  }

  const felder = FELDER[typ];

  const bereichWahl = (
    <Segmente
      label="Bereich"
      wert={bereich}
      onAendern={setBereich}
      optionen={[
        { wert: 'csv', label: 'Erfassungen (CSV)' },
        { wert: 'geo', label: 'Geodaten (SHP/GPKG)' },
      ]}
    />
  );

  if (bereich === 'geo') {
    return (
      <Seite titel="Datenimport" untertitel="Reviergrenze, Zonen, Einrichtungen und Pirschwege aus Shapefile oder GeoPackage">
        {bereichWahl}
        <Geoimport k={k} />
      </Seite>
    );
  }

  return (
    <Seite titel="Datenimport" untertitel="Historische Erfassungen aus CSV-Dateien übernehmen">
      {bereichWahl}
      <Segmente
        label="Art der Daten"
        wert={typ}
        onAendern={neuStart}
        optionen={[
          { wert: 'zaehlung', label: 'Zählungen' },
          { wert: 'abschuss', label: 'Abschüsse' },
        ]}
      />

      {meldung && <Hinweis art="erfolg">{meldung}</Hinweis>}
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}

      {!tabelle && (
        <>
          <Gruppe titel="CSV-Datei wählen" fuss={typ === 'zaehlung' ? 'Jede Zeile = eine Zählung (Datum, Wildart, Anzahl, optional Zone). Je Datum entsteht eine abgeschlossene Zählung.' : 'Jede Zeile = ein Abschuss (Datum, Wildart, optional Uhrzeit, Geschlecht, Altersklasse, Gewicht, Zone).'}>
            <div className="zeile">
              <label className="knopf knopf-sekundaer datei-knopf">
                CSV-Datei auswählen
                <input
                  type="file"
                  accept=".csv,.txt,text/csv"
                  onChange={(e) => {
                    const datei = e.target.files?.[0];
                    if (datei) void dateiLesen(datei);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </Gruppe>
          <Leer>
            Trennzeichen (Semikolon, Komma, Tab) und Zeichensatz (UTF-8 oder Windows) werden automatisch erkannt. Datumsangaben wie 14.03.2021 oder
            2021-03-14 werden verstanden. Erste Zeile = Spaltenüberschriften.
          </Leer>
          <Knopf
            variante="ghost"
            onClick={() => {
              const url = URL.createObjectURL(new Blob(['﻿' + VORLAGEN[typ]], { type: 'text/csv;charset=utf-8' }));
              const a = document.createElement('a');
              a.href = url;
              a.download = `hegewerk-vorlage-${typ === 'zaehlung' ? 'zaehlungen' : 'abschuesse'}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Vorlage herunterladen
          </Knopf>
        </>
      )}

      {tabelle && (
        <>
          <Gruppe titel={`1. Spalten zuordnen · ${dateiname}`} fuss={`${(tabelle.length - 1).toLocaleString('de-DE')} Datenzeilen gefunden`}>
            {felder.map((f) => (
              <label key={f.schluessel} className="zeile feld">
                <span className="zeile-label">
                  {f.label}
                  {f.pflicht ? ' *' : ''}
                </span>
                <select
                  value={zuordnung[f.schluessel] ?? -1}
                  onChange={(e) => setZuordnung({ ...zuordnung, [f.schluessel]: Number(e.target.value) })}
                >
                  <option value={-1}>{f.pflicht ? '– wählen –' : '– nicht vorhanden –'}</option>
                  {kopf.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Spalte ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </Gruppe>

          {auswertung.fehlendePflicht.length > 0 ? (
            <Hinweis art="fehler">Bitte noch zuordnen: {auswertung.fehlendePflicht.join(', ')}</Hinweis>
          ) : (
            <>
              {artWerte.length > 0 && (
                <Gruppe titel="2. Wildarten prüfen" fuss={offeneArten.length ? 'Nicht erkannte Wildarten bitte zuordnen – sonst werden diese Zeilen nicht importiert.' : undefined}>
                  {artWerte.map((a) => (
                    <div key={a.roh} className="zeile">
                      <span className="zeile-label">
                        „{a.roh}“<small>{a.anzahl.toLocaleString('de-DE')} Zeilen</small>
                      </span>
                      {a.auto ? (
                        <span className="badge badge-gruen">{wildarten.find((w) => w.id === a.auto)?.name}</span>
                      ) : (
                        <select
                          className="zeile-auswahl"
                          aria-label={`Wildart für ${a.roh}`}
                          value={artZuordnung[a.roh] ?? ''}
                          onChange={(e) => setArtZuordnung({ ...artZuordnung, [a.roh]: e.target.value })}
                        >
                          <option value="">nicht importieren</option>
                          <WildartOptionen wildarten={wildarten} />
                        </select>
                      )}
                    </div>
                  ))}
                </Gruppe>
              )}

              {zonenWerte.length > 0 && (
                <Gruppe titel="3. Zonen">
                  {zonenWerte.map((z) => (
                    <div key={z.roh} className="zeile">
                      <span className="zeile-label">
                        „{z.roh}“<small>{z.anzahl.toLocaleString('de-DE')} Zeilen</small>
                      </span>
                      <span className={`badge ${z.vorhanden ? 'badge-gruen' : zonenAnlegen ? 'badge-orange' : ''}`}>
                        {z.vorhanden ? 'vorhanden' : zonenAnlegen ? 'wird angelegt' : 'ohne Zone'}
                      </span>
                    </div>
                  ))}
                  {unbekannteZonen.length > 0 && (
                    <label className="zeile">
                      <input type="checkbox" checked={zonenAnlegen} onChange={(e) => setZonenAnlegen(e.target.checked)} />
                      <span className="zeile-label">
                        Unbekannte Zonen ohne Fläche neu anlegen
                        <small>Die Fläche kannst du später auf der Karte zeichnen.</small>
                      </span>
                    </label>
                  )}
                </Gruppe>
              )}

              {auswertung.probleme.length > 0 && (
                <Hinweis art="fehler">
                  <strong>{auswertung.probleme.length} Zeilen werden übersprungen:</strong>
                  <ul className="frist-liste">
                    {auswertung.probleme.slice(0, 8).map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                    {auswertung.probleme.length > 8 && <li>… und {auswertung.probleme.length - 8} weitere</li>}
                  </ul>
                </Hinweis>
              )}
              {auswertung.nullzeilen > 0 && <Leer>{auswertung.nullzeilen} Zeilen mit Anzahl 0 werden nicht übernommen.</Leer>}

              <Gruppe titel="Vorschau (erste Zeilen)">
                <div className="tabelle-rahmen" style={{ border: 0 }}>
                  <table className="tabelle">
                    <thead>
                      <tr>
                        <th scope="col">Datum</th>
                        <th scope="col">Wildart</th>
                        {typ === 'zaehlung' && <th scope="col" className="zahl">Anzahl</th>}
                        <th scope="col">Geschl.</th>
                        <th scope="col">Zone</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auswertung.ok.slice(0, 6).map((z) => (
                        <tr key={z.nr}>
                          <td>{datumDE(z.datum)}</td>
                          <td>{wildarten.find((w) => w.id === artFuer(z.wildartRoh))?.name ?? <span className="leise">? {z.wildartRoh}</span>}</td>
                          {typ === 'zaehlung' && <td className="zahl">{z.anzahl}</td>}
                          <td>{z.geschlecht === 'maennlich' ? '♂' : z.geschlecht === 'weiblich' ? '♀' : '–'}</td>
                          <td>{z.zoneRoh || '–'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Gruppe>

              <Knopf variante="akzent" disabled={laeuft || importierbar.length === 0} onClick={() => void importieren()}>
                {laeuft ? 'Import läuft …' : `${importierbar.length.toLocaleString('de-DE')} ${typ === 'zaehlung' ? 'Zählwerte' : 'Abschüsse'} importieren`}
              </Knopf>
              {importierbar.length > 0 && (
                <Leer>
                  Zeitraum {datumDE(datumVon)} bis {datumDE(datumBis)}. Ein erneuter Import derselben Datei erzeugt keine Dubletten.
                </Leer>
              )}
            </>
          )}
          <Knopf variante="ghost" onClick={() => neuStart(typ)} disabled={laeuft}>
            Andere Datei wählen
          </Knopf>
        </>
      )}
    </Seite>
  );
}
