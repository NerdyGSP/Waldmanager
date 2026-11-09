import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { AuditZeile } from '../../components/AuditZeile';
import { Symbol } from '../../components/symbole';
import { FRUCHTGRUPPEN, fruchtgruppe, normalisieren } from '../../lib/fruchtgruppen';
import type { FeldEbene, FeldFeature } from '../../lib/felder';

const ha = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 2 });

export function FeldSheet({
  feld,
  ebene,
  gleicheWerte,
  istInhaber,
  onSchliessen,
  onGeaendert,
}: {
  feld: FeldFeature['properties'];
  ebene: FeldEbene | undefined;
  /** Anzahl Schläge der Ebene mit gleichem Originalwert (inkl. diesem) */
  gleicheWerte: number;
  istInhaber: boolean;
  onSchliessen: () => void;
  onGeaendert: () => void;
}) {
  const [gruppe, setGruppe] = useState(feld.fruchtgruppe);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const g = fruchtgruppe(feld.fruchtgruppe);
  const hatRoh = !!normalisieren(feld.frucht_roh);

  async function setzen(alle: boolean) {
    setLaeuft(true);
    setFehler(null);
    const { error } = await supabase.rpc('feld_fruchtgruppe_setzen', { p_flaeche: feld.id, p_gruppe: gruppe, p_alle: alle });
    setLaeuft(false);
    if (error) return setFehler(fehlertext(error));
    onGeaendert();
  }

  return (
    <section className="zonen-info" role="dialog" aria-label={`Schlag ${feld.name}`}>
      <header className="zonen-info-kopf">
        <i className="farbpunkt" style={{ background: feld.farbe }} />
        <div>
          <strong>{feld.name || 'Schlag'}</strong>
          <AuditZeile tabelle="flaechen" id={feld.id} />
          <small>
            {g.name} · {ha(feld.flaeche_im_revier_ha)} ha im Revier
          </small>
        </div>
        <button className="zonen-info-zu" onClick={onSchliessen} aria-label="Informationsfenster schließen">
          <Symbol name="schliessen" className="symbol klein" />
        </button>
      </header>
      <dl className="feld-daten">
        {feld.schlag_nr && (
          <>
            <dt>Schlagnummer</dt>
            <dd>{feld.schlag_nr}</dd>
          </>
        )}
        <dt>Fruchtgruppe</dt>
        <dd>{g.name}</dd>
        <dt>Originalwert</dt>
        <dd>{feld.frucht_roh || '–'}</dd>
        <dt>Fläche gesamt</dt>
        <dd>{ha(feld.flaeche_ha)} ha</dd>
        <dt>Fläche im Revier</dt>
        <dd>{ha(feld.flaeche_im_revier_ha)} ha</dd>
        {ebene?.anbaujahr && (
          <>
            <dt>Anbaujahr</dt>
            <dd>{ebene.anbaujahr}</dd>
          </>
        )}
        {ebene?.quelle && (
          <>
            <dt>Quelle</dt>
            <dd>{ebene.quelle}</dd>
          </>
        )}
      </dl>
      {istInhaber && (
        <div className="feld-aendern">
          <label className="transparenz">
            <span>Gruppe ändern</span>
            <select value={gruppe} onChange={(e) => setGruppe(e.target.value)} aria-label="Fruchtgruppe wählen" disabled={laeuft}>
              {FRUCHTGRUPPEN.map((f) => (
                <option key={f.schluessel} value={f.schluessel}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <div className="bj-dialog-knoepfe" style={{ justifyContent: 'flex-start' }}>
            <button className="knopf knopf-sekundaer klein" disabled={laeuft || gruppe === feld.fruchtgruppe} onClick={() => void setzen(false)}>
              Nur dieser Schlag
            </button>
            {hatRoh && gleicheWerte > 1 && (
              <button className="knopf knopf-sekundaer klein" disabled={laeuft || gruppe === feld.fruchtgruppe} onClick={() => void setzen(true)}>
                Alle „{feld.frucht_roh}“ ({gleicheWerte})
              </button>
            )}
          </div>
          {fehler && <div className="hinweis hinweis-fehler">{fehler}</div>}
        </div>
      )}
    </section>
  );
}
