import { FlaechenmodusWahl, STANDARD_BREITE_M, type Flaechenmodus } from './FlaechenmodusWahl';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { GESCHLECHTER, useWildarten } from '../../lib/stammdaten';
import { speichernOderMerken } from '../../lib/offline';
import { heuteISO, mondphase } from '../../lib/zeit';
import type { Enums } from '../../lib/database.types';
import { Auswahl, Hinweis, Knopf, Segmente, WildartOptionen, Zaehler } from '../../components/ui';
import type { RevierKontext } from './kontext';
import { Symbol } from '../../components/symbole';

export type WteSitzung = { id: string; datum: string; ebene_id: string | null };
export type WteZone = { id: string; name: string; ebeneId: string | null };

// Bottom-Sheet im WTE-Modus: Sichtung für die angetippte Zone direkt in die aktive Zählung eintragen.
// Gibt es keine aktive Zählung, bleibt die Eingabe stehen und die Zählung wird im selben Sheet gestartet.
export function WteSichtung({
  k,
  zone,
  sitzung,
  ebenen,
  onSchliessen,
  onGespeichert,
  onSitzung,
}: {
  k: RevierKontext;
  zone: WteZone;
  sitzung: WteSitzung | null;
  ebenen: Array<{ id: string; name: string }>;
  onSchliessen: () => void;
  onGespeichert: (text: string) => void;
  onSitzung: () => Promise<WteSitzung | null>;
}) {
  const wildarten = useWildarten();
  const [wildartId, setWildartId] = useState('rehwild');
  const [anzahl, setAnzahl] = useState(1);
  const [geschlecht, setGeschlecht] = useState<Enums<'geschlecht'>>('unbekannt');
  const [altersklasse, setAltersklasse] = useState('');
  const [datum, setDatum] = useState(heuteISO());
  const [ebeneId, setEbeneId] = useState(zone.ebeneId ?? '');
  const [modus, setModus] = useState<Flaechenmodus>('zonen');
  const [breite, setBreite] = useState(STANDARD_BREITE_M);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const klassen = wildarten.find((w) => w.id === wildartId)?.altersklassen ?? [];
  const falscheEbene = !!sitzung?.ebene_id && sitzung.ebene_id !== zone.ebeneId;

  async function eintragen(s: WteSitzung) {
    // Gleiche Zeile (Zone, Wildart, Geschlecht, Altersklasse) in der Zählung hochzählen statt doppelt anzulegen
    let id: string = crypto.randomUUID();
    let summe = anzahl;
    if (navigator.onLine) {
      let q = supabase.from('zaehlungen').select('id, anzahl').eq('sitzung_id', s.id).eq('zone_id', zone.id).eq('wildart_id', wildartId).eq('geschlecht', geschlecht).is('geloescht_am', null);
      q = altersklasse ? q.eq('altersklasse', altersklasse) : q.is('altersklasse', null);
      const { data } = await q.limit(1);
      if (data?.[0]) {
        id = data[0].id;
        summe = data[0].anzahl + anzahl;
      }
    }
    const r = await speichernOderMerken({
      tabelle: 'zaehlungen',
      daten: { id, sitzung_id: s.id, revier_id: k.revierId, zone_id: zone.id, wildart_id: wildartId, geschlecht, altersklasse: altersklasse || null, anzahl: summe, erfasst_von: k.userId },
    });
    const name = wildarten.find((w) => w.id === wildartId)?.name ?? wildartId;
    onGespeichert(`${anzahl} × ${name} in „${zone.name}“ ${r === 'gemerkt' ? 'auf dem Gerät gespeichert (wird übertragen)' : 'in die Zählung eingetragen'}`);
  }

  async function speichern(startenErst: boolean) {
    setFehler(null);
    setLaeuft(true);
    try {
      let s = sitzung;
      if (startenErst) {
        const mond = mondphase(new Date(`${datum}T20:00:00`));
        const { error } = await supabase.from('zaehlsitzungen').insert({
          revier_id: k.revierId,
          datum,
          beginn: new Date().toISOString(),
          mondphase: `${mond.name} (${mond.beleuchtung} %)`,
          ebene_id: ebeneId || null,
          flaechenmodus: modus,
          streifenbreite_m: breite || STANDARD_BREITE_M,
        });
        // 23505: In diesem Revier läuft bereits eine Zählung (z. B. von einem anderen Gerät gestartet) – diese verwenden
        if (error && error.code !== '23505') throw error;
        s = await onSitzung();
        if (!s) throw new Error('Die Zählung konnte nicht gestartet werden.');
      }
      if (!s) return;
      await eintragen(s);
    } catch (err) {
      setFehler(fehlertext(err));
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <div className="wte-sheet" role="dialog" aria-label={`Sichtung in ${zone.name}`}>
      <div className="wte-sheet-kopf">
        <strong>Sichtung · {zone.name}</strong>
        <button type="button" className="link" onClick={onSchliessen} aria-label="Schließen">
          <Symbol name="schliessen" className="symbol klein" />
        </button>
      </div>
      <Auswahl label="Wildart" value={wildartId} onChange={(e) => { setWildartId(e.target.value); setAltersklasse(''); }}>
        <WildartOptionen wildarten={wildarten} />
      </Auswahl>
      <div className="zeile">
        <span className="zeile-label">Anzahl</span>
        <Zaehler label="Anzahl" wert={anzahl} min={1} onAendern={setAnzahl} />
      </div>
      <div className="zeile">
        <span className="zeile-label">Geschlecht</span>
        <Segmente label="Geschlecht" wert={geschlecht} onAendern={setGeschlecht} optionen={GESCHLECHTER.map((g) => ({ wert: g.wert, label: g.kurz }))} />
      </div>
      {klassen.length > 0 && (
        <Auswahl label="Altersklasse" value={altersklasse} onChange={(e) => setAltersklasse(e.target.value)}>
          <option value="">–</option>
          {klassen.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Auswahl>
      )}

      {sitzung ? (
        <>
          {falscheEbene && <Hinweis art="fehler">Diese Zone gehört nicht zur Zonenebene der laufenden Zählung.</Hinweis>}
          {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
          <Knopf onClick={() => void speichern(false)} disabled={laeuft || falscheEbene}>
            {laeuft ? 'Speichern …' : 'In Zählung eintragen'}
          </Knopf>
        </>
      ) : (
        <div className="wte-neue-zaehlung" role="group" aria-label="Neue Zählung">
          <Hinweis art="info">Keine laufende Zählung. Starte eine neue – deine Eingabe bleibt erhalten und wird danach übernommen.</Hinweis>
          <label className="zeile feld">
            <span className="zeile-label">Datum</span>
            <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
          </label>
          {ebenen.length > 0 && (
            <Auswahl label="Zonenebene" value={ebeneId} onChange={(e) => setEbeneId(e.target.value)}>
              <option value="">Alle Zonen</option>
              {ebenen.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Auswahl>
          )}
          <FlaechenmodusWahl modus={modus} breite={breite} onModus={setModus} onBreite={setBreite} />
          {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
          <Knopf variante="akzent" onClick={() => void speichern(true)} disabled={laeuft || !datum}>
            {laeuft ? 'Starte …' : 'Zählung starten und eintragen'}
          </Knopf>
        </div>
      )}
    </div>
  );
}
