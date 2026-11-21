import { navigieren } from '../../lib/router';
import { baumartName } from '../../lib/stammdaten';
import { bestandesalter, stadiumFarbe, stadiumLabel, wuchsstadium } from '../../lib/forst';
import { jahreText, type Zone } from '../../lib/zonen';
import { MischungsBalken } from '../../components/BaumartenEingabe';
import { Symbol } from '../../components/symbole';

/** Informationsfenster am unteren Kartenrand: Steckbrief einer Zone im Bestand */
export function ZoneInfo({
  zone,
  bestandName,
  onSchliessen,
  onBearbeiten,
  onWeitereZone,
}: {
  zone: Zone;
  bestandName: string;
  onSchliessen: () => void;
  onBearbeiten?: () => void;
  /** Weitere Zone im selben Bestand einzeichnen (auch wenn der Bestand schon voller Zonen ist) */
  onWeitereZone?: () => void;
}) {
  const stadium = wuchsstadium(zone.pflanzjahr);
  const alter = bestandesalter(zone.pflanzjahr);
  return (
    <section className="zonen-info" role="dialog" aria-label={`Zone ${zone.name}`}>
      <header className="zonen-info-kopf">
        <i className="farbpunkt" style={{ background: stadiumFarbe(stadium) }} />
        <div>
          <strong>
            {zone.name} · Bestand {bestandName}
          </strong>
          <small>
            {[
              stadiumLabel(stadium),
              zone.pflanzjahr ? `Pflanzung ${zone.pflanzjahr}${alter != null ? ` (${alter} J.)` : ''}` : null,
              zone.flaecheHa != null ? `${zone.flaecheHa.toLocaleString('de-DE')} ha` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </small>
        </div>
        {onBearbeiten && (
          <button className="knopf knopf-sekundaer klein" onClick={onBearbeiten}>
            Punkte bearbeiten
          </button>
        )}
        {onWeitereZone && (
          <button className="knopf knopf-sekundaer klein" onClick={onWeitereZone}>
            Weitere Zone
          </button>
        )}
        <button className="knopf knopf-ghost klein" onClick={() => navigieren(`/bestaende/${zone.bestandId}`)}>
          Zonendaten
        </button>
        <button className="zonen-info-zu" onClick={onSchliessen} aria-label="Informationsfenster schließen">
          <Symbol name="schliessen" className="symbol klein" />
        </button>
      </header>

      {(zone.baumarten.length > 0 || zone.durchforstungen.length > 0 || zone.bemerkung) && (
        <div className="bestand-mischung">
          {zone.baumarten.length > 0 && <MischungsBalken wert={zone.baumarten} />}
          <p className="leer" style={{ margin: 0 }}>
            {[
              zone.baumarten.map((b) => `${baumartName(b.art)} ${b.anteil} %`).join(' · ') || null,
              zone.durchforstungen.length ? `Durchforstet ${jahreText(zone.durchforstungen)}` : 'Noch nicht durchforstet',
              zone.bemerkung,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      )}
    </section>
  );
}
