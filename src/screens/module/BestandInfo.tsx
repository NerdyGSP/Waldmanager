import { navigieren } from '../../lib/router';
import { baumartName, type Baumartenanteil } from '../../lib/stammdaten';
import { bestandesalter } from '../../lib/forst';
import { Symbol } from '../../components/symbole';

export type GewaehlterBestand = {
  id: string;
  name: string;
  farbe: string | null;
  flaecheHa: number | null;
  bestandestyp: string | null;
  baumarten: Baumartenanteil[];
  pflanzjahr: number | null;
  vorratVfmHa: number | null;
};

/** Informationsfenster am unteren Kartenrand: Steckbrief eines Bestands */
export function BestandInfo({
  bestand,
  onSchliessen,
  onBearbeiten,
}: {
  bestand: GewaehlterBestand;
  onSchliessen: () => void;
  onBearbeiten?: () => void;
}) {
  const alter = bestandesalter(bestand.pflanzjahr);
  const gesamtVorrat = bestand.vorratVfmHa != null && bestand.flaecheHa != null ? Math.round(bestand.vorratVfmHa * bestand.flaecheHa) : null;
  return (
    <section className="zonen-info" role="dialog" aria-label={`Bestand ${bestand.name}`}>
      <header className="zonen-info-kopf">
        <i className="farbpunkt" style={{ background: bestand.farbe ?? 'var(--color-primary)' }} />
        <div>
          <strong>Bestand {bestand.name}</strong>
          <small>
            {[bestand.bestandestyp, bestand.flaecheHa != null ? `${bestand.flaecheHa.toLocaleString('de-DE')} ha` : null, alter != null ? `${alter} Jahre` : null]
              .filter(Boolean)
              .join(' · ') || 'Noch keine Bestandsdaten'}
          </small>
        </div>
        {onBearbeiten && (
          <button className="knopf knopf-sekundaer klein" onClick={onBearbeiten}>
            Punkte bearbeiten
          </button>
        )}
        <button className="knopf knopf-ghost klein" onClick={() => navigieren(`/bestaende/${bestand.id}`)}>
          Bestandsdaten
        </button>
        <button className="zonen-info-zu" onClick={onSchliessen} aria-label="Informationsfenster schließen">
          <Symbol name="schliessen" className="symbol klein" />
        </button>
      </header>

      {bestand.baumarten.length > 0 && (
        <div className="bestand-mischung">
          <div className="mischung-balken" role="img" aria-label={bestand.baumarten.map((b) => `${baumartName(b.art)} ${b.anteil} %`).join(', ')}>
            {bestand.baumarten.map((b) => (
              <span key={b.art} style={{ width: `${b.anteil}%` }} data-art={b.art} />
            ))}
          </div>
          <p className="leer" style={{ margin: 0 }}>
            {bestand.baumarten.map((b) => `${baumartName(b.art)} ${b.anteil} %`).join(' · ')}
            {gesamtVorrat != null ? ` · Vorrat ${gesamtVorrat.toLocaleString('de-DE')} Vfm` : ''}
          </p>
        </div>
      )}
    </section>
  );
}
