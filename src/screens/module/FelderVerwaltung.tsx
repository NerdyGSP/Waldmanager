import { useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { useFelder, gruppenFarbe } from '../../lib/felder';
import { FRUCHTGRUPPEN } from '../../lib/fruchtgruppen';
import { navigieren } from '../../lib/router';
import { Farbwahl, Feld, Gruppe, Hinweis, Knopf, Leer } from '../../components/ui';
import { AuditZeile } from '../../components/AuditZeile';
import type { RevierKontext } from './kontext';

const ha = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 });
const datum = (iso: string) => new Date(iso).toLocaleDateString('de-DE');

// Bereich „Felder“ in Zonen & Routen: Ebenen der Feldgrenzen verwalten
export function FelderVerwaltung({ k }: { k: RevierKontext }) {
  const [offenId, setOffenId] = useState<string | null>(null);
  const felder = useFelder(k.revierId, true, offenId);
  const [fehler, setFehler] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [jahr, setJahr] = useState('');
  const [loeschId, setLoeschId] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const ebene = felder.ebenen.find((e) => e.id === (offenId ?? felder.ebeneId));

  const summen = useMemo(() => {
    const m = new Map<string, { n: number; ha: number }>();
    for (const f of felder.fc.features) {
      const e = m.get(f.properties.fruchtgruppe) ?? { n: 0, ha: 0 };
      e.n++;
      e.ha += f.properties.flaeche_im_revier_ha;
      m.set(f.properties.fruchtgruppe, e);
    }
    return m;
  }, [felder.fc]);
  const gesamtHa = [...summen.values()].reduce((a, v) => a + v.ha, 0);

  async function aendern(id: string, werte: { name?: string; anbaujahr?: number | null; farben?: Record<string, string> }) {
    if (!k.istInhaber) return;
    setLaeuft(true);
    setFehler(null);
    const { error } = await supabase.from('flaechen_ebenen').update(werte).eq('id', id);
    setLaeuft(false);
    if (error) return setFehler(fehlertext(error));
    await felder.laden();
  }
  async function loeschen(id: string) {
    setLaeuft(true);
    setFehler(null);
    const { error } = await supabase.from('flaechen_ebenen').delete().eq('id', id);
    setLaeuft(false);
    setLoeschId(null);
    if (error) return setFehler(fehlertext(error));
    setOffenId(null);
    await felder.laden();
  }

  return (
    <>
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      {felder.ebenen.length === 0 ? (
        <Gruppe titel="Feldgrenzen">
          <Leer>{felder.fehler ? 'Feldgrenzen konnten nicht geladen werden.' : 'Noch keine Feldgrenzen importiert.'}</Leer>
          {k.istInhaber && (
            <div style={{ padding: '0 12px 12px' }}>
              <Knopf variante="sekundaer" onClick={() => navigieren('/import')}>Zum Datenimport</Knopf>
            </div>
          )}
        </Gruppe>
      ) : (
        <Gruppe titel={`Ebenen (${felder.ebenen.length})`} fuss="Importiert werden Schläge im Datenimport (Ziel „Feldgrenzen“). Pro Anbaujahr gibt es eine Ebene; in der Karte ist immer eine Ebene sichtbar.">
          {felder.ebenen.map((e) => (
            <button
              key={e.id}
              type="button"
              className="zeile feld-ebene"
              aria-expanded={ebene?.id === e.id}
              onClick={() => {
                setOffenId(e.id);
                setName(e.name);
                setJahr(e.anbaujahr ? String(e.anbaujahr) : '');
                setLoeschId(null);
              }}
            >
              <span className="zeile-label">
                {e.name}
                <small>
                  {e.anbaujahr ?? 'Jahr offen'} · {e.anzahl.toLocaleString('de-DE')} Schläge · {ha(e.hektar)} ha · {e.quelle ?? 'ohne Quelle'} · importiert {datum(e.erstellt_am)}
                </small>
              </span>
            </button>
          ))}
        </Gruppe>
      )}

      {ebene && offenId === ebene.id && (
        <>
          <Gruppe titel={`Ebene „${ebene.name}“`}>
            <div className="zeile"><AuditZeile tabelle="flaechen_ebenen" id={ebene.id} aktualisierung={ebene.name} /></div>
            {k.istInhaber && (
              <>
                <Feld label="Name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
                <Feld label="Anbaujahr" type="number" inputMode="numeric" min={1990} max={2100} value={jahr} onChange={(e) => setJahr(e.target.value)} />
                <div className="zeile">
                  <Knopf
                    variante="sekundaer"
                    disabled={laeuft || !name.trim() || (name.trim() === ebene.name && Number(jahr || 0) === (ebene.anbaujahr ?? 0))}
                    onClick={() => void aendern(ebene.id, { name: name.trim(), anbaujahr: jahr ? Number(jahr) : null })}
                  >
                    Speichern
                  </Knopf>
                </div>
              </>
            )}
          </Gruppe>

          <Gruppe titel="Fruchtgruppen" fuss="Farben gelten für diese Ebene. „Standard“ setzt die Grundfarbe zurück.">
            {FRUCHTGRUPPEN.filter((g) => summen.has(g.schluessel) || k.istInhaber).map((g) => {
              const s = summen.get(g.schluessel);
              const eigene = ebene.farben[g.schluessel];
              return (
                <div key={g.schluessel} className="zeile">
                  <span className="zeile-label">
                    {g.name}
                    <small>{s ? `${s.n.toLocaleString('de-DE')} Schläge · ${ha(s.ha)} ha · ${gesamtHa ? Math.round((s.ha / gesamtHa) * 100) : 0} %` : 'kommt nicht vor'}</small>
                  </span>
                  {k.istInhaber ? (
                    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <Farbwahl wert={gruppenFarbe(ebene.farben, g.schluessel)} label={`Farbe ${g.name}`} onAendern={(f) => void aendern(ebene.id, { farben: { ...ebene.farben, [g.schluessel]: f } })} />
                      {eigene && (
                        <Knopf
                          variante="ghost"
                          onClick={() => {
                            const rest = { ...ebene.farben };
                            delete rest[g.schluessel];
                            void aendern(ebene.id, { farben: rest });
                          }}
                        >
                          Standard
                        </Knopf>
                      )}
                    </span>
                  ) : (
                    <i className="farbpunkt" style={{ background: gruppenFarbe(ebene.farben, g.schluessel) }} />
                  )}
                </div>
              );
            })}
            <div className="zeile">
              <span className="zeile-label">Summe<small>{felder.fc.features.length.toLocaleString('de-DE')} Schläge · {ha(gesamtHa)} ha im Revier</small></span>
            </div>
          </Gruppe>

          {k.istInhaber && (
            <Gruppe titel="Ebene löschen">
              {loeschId === ebene.id ? (
                <div className="zeile">
                  <Knopf variante="gefahr" disabled={laeuft} onClick={() => void loeschen(ebene.id)}>Ja, Ebene samt {ebene.anzahl.toLocaleString('de-DE')} Schlägen löschen</Knopf>
                  <Knopf variante="ghost" onClick={() => setLoeschId(null)}>Abbrechen</Knopf>
                </div>
              ) : (
                <div className="zeile">
                  <Knopf variante="gefahr" onClick={() => setLoeschId(ebene.id)}>Ebene löschen …</Knopf>
                </div>
              )}
            </Gruppe>
          )}
        </>
      )}
    </>
  );
}
