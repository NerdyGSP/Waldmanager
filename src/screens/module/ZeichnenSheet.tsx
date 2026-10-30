import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { datumDE } from '../../lib/zeit';
import { nameVergeben, ZONENFARBEN, type Zone } from '../../lib/stammdaten';
import { freierName, routenTypLabel, type RoutenEbene } from '../../lib/routen';
import { Auswahl, Farbwahl, Feld, Hinweis, Knopf } from '../../components/ui';

export type SheetArt = 'grenze' | 'zone' | 'pirschweg' | 'treiberroute' | 'wte_route';
export type SheetWerte = {
  name: string;
  bemerkung: string;
  zoneId: string | null; // Zone: null = neue Zone, sonst bestehende Zone (Fläche ersetzen)
  ebeneId: string;
  farbe: string;
  wteAktiv: boolean;
  bewegungsjagdId: string;
  sitzungId: string;
  /** Routen: Zielebene (leer = ohne Ebene) oder Name einer neu anzulegenden Ebene */
  routenEbeneId: string;
  neueEbeneName: string;
};
type Ebene = { id: string; name: string; farbe: string | null; wte_aktiv?: boolean };

const TITEL: Record<SheetArt, string> = {
  grenze: 'Reviergrenze speichern',
  zone: 'Zone speichern',
  pirschweg: 'Pirschweg speichern',
  treiberroute: 'Treiberroute speichern',
  wte_route: 'WTE-Route speichern',
};
const STANDARDNAME: Record<Exclude<SheetArt, 'grenze' | 'zone'>, string> = { pirschweg: 'Pirschweg', treiberroute: 'Treiberroute', wte_route: 'WTE-Route' };

// Bottom-Sheet für Benennung und Details nach dem Zeichnen bzw. Aufzeichnen
export function ZeichnenSheet({
  art,
  revierId,
  zonen,
  ebenen,
  hatGrenze,
  info,
  speichert,
  fehler,
  onSpeichern,
  onAbbrechen,
  standardSitzungId,
  routenEbenen = [],
  routenNamen = [],
  darfEbenenAnlegen = false,
}: {
  art: SheetArt;
  revierId: string;
  zonen: Zone[];
  ebenen: Ebene[];
  hatGrenze: boolean;
  info: string;
  speichert: boolean;
  fehler: string | null;
  onSpeichern: (w: SheetWerte) => void;
  onAbbrechen: () => void;
  standardSitzungId?: string | null; // laufende WTE: WTE-Routen werden ihr automatisch zugeordnet
  routenEbenen?: RoutenEbene[];
  routenNamen?: string[];
  darfEbenenAnlegen?: boolean;
}) {
  const [name, setName] = useState(art === 'zone' ? `Zone ${zonen.length + 1}` : art === 'grenze' ? '' : freierName(routenNamen, STANDARDNAME[art]));
  const [routenEbeneId, setRoutenEbeneId] = useState('');
  const [neueEbeneName, setNeueEbeneName] = useState('');
  const [bemerkung, setBemerkung] = useState('');
  const [zoneId, setZoneId] = useState<string>('');
  const [ebeneId, setEbeneId] = useState('');
  const [farbe, setFarbe] = useState(ZONENFARBEN[zonen.length % ZONENFARBEN.length]!);
  const [wteAktiv, setWteAktiv] = useState(false);
  const [bewegungsjagdId, setBewegungsjagdId] = useState('');
  const [sitzungId, setSitzungId] = useState(standardSitzungId ?? '');
  const [bestaetigt, setBestaetigt] = useState(false);
  const [jagden, setJagden] = useState<Array<{ id: string; titel: string; datum: string }>>([]);
  const [sitzungen, setSitzungen] = useState<Array<{ id: string; datum: string; status: string }>>([]);

  useEffect(() => {
    if (art === 'treiberroute') {
      void supabase.from('bewegungsjagden').select('id, titel, datum').eq('revier_id', revierId).is('geloescht_am', null).order('datum', { ascending: false }).limit(30).then(({ data }) => setJagden(data ?? []));
    }
    if (art === 'wte_route') {
      void supabase.from('zaehlsitzungen').select('id, datum, status').eq('revier_id', revierId).is('geloescht_am', null).order('datum', { ascending: false }).limit(20).then(({ data }) => {
        setSitzungen(data ?? []);
        // Läuft gerade eine Zählung, wird die WTE-Route ihr automatisch zugeordnet
        const offen = (data ?? []).find((s) => s.status === 'offen');
        if (offen) setSitzungId((alt) => alt || offen.id);
      });
    }
  }, [art, revierId]);

  const ebene = ebenen.find((e) => e.id === ebeneId);
  const neueZone = art === 'zone' && !zoneId;
  const doppelt = neueZone && nameVergeben(zonen.map((z) => z.name), name);
  const istRoute = art === 'pirschweg' || art === 'treiberroute' || art === 'wte_route';
  const passendeEbenen = istRoute ? routenEbenen.filter((e) => e.typ === art) : [];
  const routeDoppelt = istRoute && nameVergeben(routenNamen, name);
  const ebeneNeu = routenEbeneId === '__neu';
  const neueEbeneDoppelt = ebeneNeu && !!neueEbeneName.trim() && nameVergeben(routenEbenen.map((e) => e.name), neueEbeneName);
  const gueltig =
    art === 'grenze'
      ? !hatGrenze || bestaetigt
      : art === 'zone'
        ? !!zoneId || (!!name.trim() && !doppelt)
        : !!name.trim() && !routeDoppelt && (!ebeneNeu || (!!neueEbeneName.trim() && !neueEbeneDoppelt));

  return (
    <div className="wte-sheet zeichnen-sheet" role="dialog" aria-modal="false" aria-label={TITEL[art]}>
      <div className="wte-sheet-kopf">
        <strong>{TITEL[art]}</strong>
        <button type="button" className="link" onClick={onAbbrechen}>
          Zurück zur Karte
        </button>
      </div>
      <p className="leer" style={{ margin: 0 }}>{info}</p>

      {art === 'grenze' && hatGrenze && (
        <Hinweis art="warnung">
          Die neue Grenze <strong>ersetzt die bestehende Reviergrenze</strong>.
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
            <input type="checkbox" checked={bestaetigt} onChange={(e) => setBestaetigt(e.target.checked)} /> Ja, bestehende Grenze ersetzen
          </label>
        </Hinweis>
      )}

      {art === 'zone' && (
        <>
          {zonen.length > 0 && (
            <Auswahl label="Zuordnen zu" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
              <option value="">Neue Zone</option>
              {zonen.map((z) => (
                <option key={z.id} value={z.id}>
                  Fläche von „{z.name}“ ersetzen{z.hatGeometrie ? '' : ' (noch ohne Fläche)'}
                </option>
              ))}
            </Auswahl>
          )}
          {neueZone && (
            <>
              <Feld label="Name" value={name} onChange={(e) => setName(e.target.value)} />
              {doppelt && <Hinweis art="fehler">Eine Zone „{name.trim()}“ gibt es in diesem Revier bereits.</Hinweis>}
              {ebenen.length > 0 && (
                <Auswahl
                  label="Zonenebene"
                  value={ebeneId}
                  onChange={(e) => {
                    setEbeneId(e.target.value);
                    const x = ebenen.find((y) => y.id === e.target.value);
                    setWteAktiv(!!x?.wte_aktiv);
                    if (x?.farbe) setFarbe(x.farbe);
                  }}
                >
                  <option value="">Ohne Ebene</option>
                  {ebenen.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </Auswahl>
              )}
              <label className="ebene" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                Farbe
                <Farbwahl wert={farbe} label="Farbe der Zone" onAendern={setFarbe} />
              </label>
              {ebene && (
                <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="checkbox" checked={wteAktiv} onChange={(e) => setWteAktiv(e.target.checked)} /> WTE-relevant (Ebene „{ebene.name}“ im WTE-Modus anzeigen)
                </label>
              )}
            </>
          )}
        </>
      )}

      {(art === 'pirschweg' || art === 'treiberroute' || art === 'wte_route') && (
        <>
          <Feld label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          {art === 'treiberroute' && (
            <Auswahl label="Bewegungsjagd (optional)" value={bewegungsjagdId} onChange={(e) => setBewegungsjagdId(e.target.value)}>
              <option value="">– keine, revierweit –</option>
              {jagden.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.titel} · {datumDE(j.datum)}
                </option>
              ))}
            </Auswahl>
          )}
          {art === 'wte_route' && (
            <Auswahl label="Zählsitzung (optional)" value={sitzungId} onChange={(e) => setSitzungId(e.target.value)}>
              <option value="">– keine –</option>
              {sitzungen.map((s) => (
                <option key={s.id} value={s.id}>
                  Zählung {datumDE(s.datum)}
                  {s.status === 'offen' ? ' (läuft)' : ''}
                </option>
              ))}
            </Auswahl>
          )}
          {routeDoppelt && <Hinweis art="fehler">Eine Route „{name.trim()}“ gibt es in diesem Revier bereits.</Hinweis>}
          {(passendeEbenen.length > 0 || darfEbenenAnlegen) && (
            <Auswahl label={`Ebene (${routenTypLabel(art)})`} value={routenEbeneId} onChange={(e) => setRoutenEbeneId(e.target.value)}>
              <option value="">Ohne Ebene</option>
              {passendeEbenen.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
              {darfEbenenAnlegen && <option value="__neu">+ Neue Ebene anlegen …</option>}
            </Auswahl>
          )}
          {ebeneNeu && (
            <>
              <Feld label="Name der neuen Ebene" value={neueEbeneName} onChange={(e) => setNeueEbeneName(e.target.value)} />
              {neueEbeneDoppelt && <Hinweis art="fehler">Eine Ebene „{neueEbeneName.trim()}“ gibt es bereits.</Hinweis>}
            </>
          )}
          <Feld label="Bemerkung (optional)" value={bemerkung} onChange={(e) => setBemerkung(e.target.value)} />
        </>
      )}

      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      <div className="bj-dialog-knoepfe">
        <Knopf variante="ghost" onClick={onAbbrechen}>
          Weiter zeichnen
        </Knopf>
        <Knopf
          variante="akzent"
          disabled={speichert || !gueltig}
          onClick={() => onSpeichern({ name: name.trim(), bemerkung: bemerkung.trim(), zoneId: zoneId || null, ebeneId, farbe, wteAktiv, bewegungsjagdId, sitzungId, routenEbeneId: ebeneNeu ? '' : routenEbeneId, neueEbeneName: ebeneNeu ? neueEbeneName.trim() : '' })}
        >
          {speichert ? 'Speichere …' : 'Speichern'}
        </Knopf>
      </div>
    </div>
  );
}
