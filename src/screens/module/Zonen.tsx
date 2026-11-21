import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { navigieren } from '../../lib/router';
import { baumartenLesen, baumartenText, nameVergeben, type Baumartenanteil, type Bestand } from '../../lib/stammdaten';
import { baumartenPruefen, bestandesalter, stadiumFarbe, stadiumLabel, wuchsstadium } from '../../lib/forst';
import { BaumartenEingabe } from '../../components/BaumartenEingabe';
import { Feld, Gruppe, Hinweis, Knopf, Leer } from '../../components/ui';
import type { BetriebKontext } from './kontext';

type ZoneZeile = {
  id: string;
  name: string;
  baumarten: Baumartenanteil[];
  pflanzjahr: number | null;
  bemerkung: string | null;
  /** erledigte Durchforstungen der Zone: Maßnahmen-ID und Jahr */
  durchforstungen: Array<{ id: string; jahr: number }>;
};

/** Jahr einer erledigten Durchforstung: Termin, sonst Erledigt-Datum (wie in karte_daten) */
const jahrVon = (m: { faellig_am: string | null; erledigt_am: string | null }) => Number((m.faellig_am ?? m.erledigt_am ?? '').slice(0, 4));

// Abschnitt im Bestandsdetail: Zonen des Bestands mit eigenem Mix, Pflanzjahr und Durchforstungen
export function ZonenAbschnitt({ k, bestand }: { k: BetriebKontext; bestand: Bestand }) {
  const [zonen, setZonen] = useState<ZoneZeile[] | null>(null);
  const [offen, setOffen] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const z = await supabase
      .from('bestand_zonen')
      .select('id, name, baumarten, pflanzjahr, bemerkung')
      .eq('bestand_id', bestand.id)
      .is('geloescht_am', null)
      .order('name');
    if (z.error) {
      setFehler(fehlertext(z.error));
      setZonen([]);
      return;
    }
    const ids = (z.data ?? []).map((x) => x.id);
    const m = ids.length
      ? await supabase
          .from('massnahmen')
          .select('id, zone_id, faellig_am, erledigt_am')
          .in('zone_id', ids)
          .eq('typ', 'durchforstung')
          .eq('status', 'erledigt')
          .is('geloescht_am', null)
      : { data: [] as Array<{ id: string; zone_id: string | null; faellig_am: string | null; erledigt_am: string | null }>, error: null };
    setFehler(m.error ? fehlertext(m.error) : null);
    setZonen(
      (z.data ?? []).map((x) => ({
        id: x.id,
        name: x.name,
        baumarten: baumartenLesen(x.baumarten),
        pflanzjahr: x.pflanzjahr,
        bemerkung: x.bemerkung,
        durchforstungen: (m.data ?? [])
          .filter((d) => d.zone_id === x.id)
          .map((d) => ({ id: d.id, jahr: jahrVon(d) }))
          .filter((d) => d.jahr > 0)
          .sort((a, b) => a.jahr - b.jahr),
      })),
    );
  }, [bestand.id]);

  useEffect(() => {
    void laden();
  }, [laden]);

  return (
    <Gruppe
      titel="Zonen"
      fuss={
        bestand.hatGeometrie
          ? 'Teilflächen mit eigenem Alter und eigener Mischung. Einzeichnen auf der Karte: Bestand antippen → „Zone einzeichnen“.'
          : 'Zonen kannst du einzeichnen, sobald der Bestand eine Fläche hat.'
      }
    >
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      {zonen === null ? (
        <Leer>Zonen werden geladen …</Leer>
      ) : zonen.length === 0 ? (
        <Leer>Noch keine Zonen – der ganze Bestand gilt mit den Daten oben.</Leer>
      ) : (
        zonen.map((z) => {
          const stadium = wuchsstadium(z.pflanzjahr);
          const alter = bestandesalter(z.pflanzjahr);
          return (
            <div key={z.id}>
              <button type="button" className="zeile zeile-knopf" aria-expanded={offen === z.id} onClick={() => setOffen(offen === z.id ? null : z.id)}>
                <span className="zeile-label">
                  <i className="farbpunkt" style={{ background: stadiumFarbe(stadium) }} /> {z.name}
                  <small>
                    {[
                      stadium ? stadiumLabel(stadium) : null,
                      z.pflanzjahr ? `Pflanzung ${z.pflanzjahr}${alter != null ? ` (${alter} J.)` : ''}` : null,
                      z.baumarten.length ? baumartenText(z.baumarten) : null,
                      z.durchforstungen.length ? `DF ${z.durchforstungen.map((d) => d.jahr).join(', ')}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Noch keine Daten'}
                  </small>
                </span>
                <span className="zeile-wert" aria-hidden="true">
                  {offen === z.id ? '‹' : '›'}
                </span>
              </button>
              {offen === z.id && (
                <ZoneBearbeiten
                  key={z.id}
                  k={k}
                  bestand={bestand}
                  zone={z}
                  alleNamen={zonen.map((x) => x.name)}
                  onGeaendert={laden}
                  onEntfernt={async () => {
                    setOffen(null);
                    await laden();
                  }}
                />
              )}
            </div>
          );
        })
      )}
    </Gruppe>
  );
}

function ZoneBearbeiten({
  k,
  bestand,
  zone,
  alleNamen,
  onGeaendert,
  onEntfernt,
}: {
  k: BetriebKontext;
  bestand: Bestand;
  zone: ZoneZeile;
  alleNamen: string[];
  onGeaendert: () => Promise<void>;
  onEntfernt: () => Promise<void>;
}) {
  const darf = k.istInhaber;
  const [name, setName] = useState(zone.name);
  const [pflanzjahr, setPflanzjahr] = useState(zone.pflanzjahr != null ? String(zone.pflanzjahr) : '');
  const [bemerkung, setBemerkung] = useState(zone.bemerkung ?? '');
  const [mischung, setMischung] = useState<Baumartenanteil[]>(zone.baumarten);
  const [dfJahr, setDfJahr] = useState('');
  const [meldung, setMeldung] = useState<{ art: 'fehler' | 'erfolg'; text: string } | null>(null);
  const [loeschenFrage, setLoeschenFrage] = useState(false);
  const jahrJetzt = new Date().getFullYear();

  async function speichern(e: FormEvent) {
    e.preventDefault();
    setMeldung(null);
    const n = name.trim();
    if (nameVergeben(alleNamen, n, zone.name)) return setMeldung({ art: 'fehler', text: `Eine Zone „${n}“ gibt es in diesem Bestand bereits.` });
    const pj = pflanzjahr.trim() ? Number(pflanzjahr) : null;
    if (pj !== null && (!Number.isInteger(pj) || pj < 1700 || pj > jahrJetzt + 1)) return setMeldung({ art: 'fehler', text: 'Bitte das Pflanzjahr vierstellig angeben, z. B. 2008.' });
    const mf = baumartenPruefen(mischung);
    if (mf) return setMeldung({ art: 'fehler', text: mf });
    const { error } = await supabase
      .from('bestand_zonen')
      .update({ name: n, pflanzjahr: pj, bemerkung: bemerkung.trim() || null, baumarten: mischung })
      .eq('id', zone.id);
    if (error) return setMeldung({ art: 'fehler', text: fehlertext(error) });
    setMeldung({ art: 'erfolg', text: 'Zone gespeichert' });
    await onGeaendert();
  }

  // Durchforstung nachtragen = erledigte Maßnahme „Durchforstung“ mit Termin im angegebenen Jahr
  async function durchforstungEintragen() {
    setMeldung(null);
    const j = Number(dfJahr);
    if (!Number.isInteger(j) || j < 1900 || j > jahrJetzt) return setMeldung({ art: 'fehler', text: `Bitte ein Jahr zwischen 1900 und ${jahrJetzt} angeben.` });
    const { error } = await supabase.from('massnahmen').insert({
      betrieb_id: k.betriebId,
      bestand_id: bestand.id,
      zone_id: zone.id,
      typ: 'durchforstung',
      status: 'erledigt',
      titel: `Durchforstung ${bestand.name} – ${zone.name}`,
      faellig_am: `${j}-07-01`,
      beschreibung: 'nachgetragen',
    });
    if (error) return setMeldung({ art: 'fehler', text: fehlertext(error) });
    setDfJahr('');
    await onGeaendert();
  }

  async function durchforstungEntfernen(id: string) {
    const { error } = await supabase.from('massnahmen').update({ geloescht_am: new Date().toISOString() }).eq('id', id);
    if (error) setMeldung({ art: 'fehler', text: fehlertext(error) });
    await onGeaendert();
  }

  async function entfernen() {
    // Weiches Löschen; Maßnahmen behalten den Bestand
    const { error } = await supabase.from('bestand_zonen').update({ geloescht_am: new Date().toISOString() }).eq('id', zone.id);
    if (error) return setMeldung({ art: 'fehler', text: fehlertext(error) });
    await onEntfernt();
  }

  return (
    <div className="zone-bearbeiten">
      <form onSubmit={speichern}>
        <Feld label="Name" required disabled={!darf} value={name} onChange={(e) => setName(e.target.value)} />
        <Feld
          label="Pflanzjahr"
          disabled={!darf}
          inputMode="numeric"
          placeholder="z. B. 2008"
          value={pflanzjahr}
          onChange={(e) => setPflanzjahr(e.target.value.replace(/\D/g, '').slice(0, 4))}
        />
        <Feld label="Bemerkung" disabled={!darf} placeholder="optional, z. B. Kyrill-Fläche, Naturverjüngung" value={bemerkung} onChange={(e) => setBemerkung(e.target.value)} />
        <BaumartenEingabe titel="Baumarten der Zone" wert={mischung} onAendern={setMischung} darf={darf} />
        {darf && (
          <Knopf type="submit" variante="sekundaer">
            Zone speichern
          </Knopf>
        )}
      </form>

      <Gruppe titel="Durchforstungen" fuss="Aus erledigten Maßnahmen „Durchforstung“ dieser Zone. Frühere Jahre hier nachtragen.">
        {zone.durchforstungen.length === 0 ? (
          <Leer>Noch keine Durchforstung eingetragen.</Leer>
        ) : (
          zone.durchforstungen.map((d) => (
            <div key={d.id} className="zeile">
              <span className="zeile-label">{d.jahr}</span>
              <button type="button" className="link gefahr" onClick={() => void durchforstungEntfernen(d.id)}>
                Entfernen
              </button>
            </div>
          ))
        )}
        <div className="zeile">
          <input
            aria-label="Jahr der Durchforstung"
            inputMode="numeric"
            placeholder={`Jahr, z. B. ${jahrJetzt - 4}`}
            value={dfJahr}
            onChange={(e) => setDfJahr(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
          <button type="button" className="link" disabled={dfJahr.length !== 4} onClick={() => void durchforstungEintragen()}>
            + Durchforstung eintragen
          </button>
        </div>
      </Gruppe>

      {meldung && <Hinweis art={meldung.art}>{meldung.text}</Hinweis>}

      <Knopf variante="ghost" onClick={() => navigieren('/karte')}>
        Auf der Karte ansehen
      </Knopf>
      {darf &&
        (loeschenFrage ? (
          <>
            <Hinweis art="warnung">Zone „{zone.name}“ entfernen? Durchforstungen bleiben als Maßnahmen des Bestands erhalten.</Hinweis>
            <Knopf variante="gefahr" onClick={() => void entfernen()}>
              Endgültig entfernen
            </Knopf>
            <Knopf variante="ghost" onClick={() => setLoeschenFrage(false)}>
              Abbrechen
            </Knopf>
          </>
        ) : (
          <Knopf variante="gefahr" onClick={() => setLoeschenFrage(true)}>
            Zone entfernen
          </Knopf>
        ))}
    </div>
  );
}
