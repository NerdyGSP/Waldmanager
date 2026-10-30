import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { navigieren } from '../../lib/router';
import { nameVergeben, zufallsFarben, ZONENFARBEN } from '../../lib/stammdaten';
import { freierName, kmText, ROUTENFOKUS, ROUTENTYPEN, routenTypFarbe, routenTypLabel, useRouten, useRoutenEbenen, type Route, type RouteTyp, type RoutenEbene } from '../../lib/routen';
import { Auswahl, Farbwahl, Feld, Gruppe, Hinweis, Knopf, Leer, Zeile } from '../../components/ui';
import { Symbol } from '../../components/symbole';
import type { RevierKontext } from './kontext';

const SPEICHER = 'hegewerk.routen.zu';

// Reiter „Routen“ im Modul „Zonen & Routen“: Ebenen aufklappbar, darunter die Routen
export function Routen({ k }: { k: RevierKontext }) {
  const { routen, laedt, laden } = useRouten(k.revierId);
  const { ebenen, laden: ebenenLaden } = useRoutenEbenen(k.revierId);
  const [fehler, setFehler] = useState<string | null>(null);
  const [zu, setZu] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(SPEICHER) ?? '[]') as string[]);
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(SPEICHER, JSON.stringify([...zu]));
    } catch {
      /* nur für diese Sitzung */
    }
  }, [zu]);
  const umschalten = (id: string) =>
    setZu((alt) => {
      const n = new Set(alt);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const alleNeu = async () => {
    await Promise.all([laden(), ebenenLaden()]);
  };

  const gruppen = useMemo(() => {
    const liste: Array<{ ebene: RoutenEbene | null; routen: Route[] }> = ebenen.map((e) => ({ ebene: e, routen: routen.filter((r) => r.ebeneId === e.id) }));
    const ohne = routen.filter((r) => !r.ebeneId || !ebenen.some((e) => e.id === r.ebeneId));
    if (ohne.length || ebenen.length === 0) liste.push({ ebene: null, routen: ohne });
    return liste;
  }, [routen, ebenen]);

  const routenNamen = routen.map((r) => r.name);

  async function umbenennen(r: Route) {
    const neu = window.prompt('Neuer Name der Route:', r.name)?.trim();
    if (!neu || neu === r.name) return;
    if (nameVergeben(routenNamen, neu, r.name)) return setFehler(`Eine Route „${neu}“ gibt es in diesem Revier bereits.`);
    const { error } = await supabase.from('pirschwege').update({ name: neu }).eq('id', r.id);
    setFehler(error ? fehlertext(error) : null);
    await alleNeu();
  }
  async function farbeSetzen(r: Route, farbe: string) {
    const { error } = await supabase.from('pirschwege').update({ farbe }).eq('id', r.id);
    setFehler(error ? fehlertext(error) : null);
    await alleNeu();
  }
  async function ebeneZuweisen(r: Route, ebeneId: string) {
    const { error } = await supabase.from('pirschwege').update({ ebene_id: ebeneId || null }).eq('id', r.id);
    setFehler(error ? fehlertext(error) : null);
    await alleNeu();
  }
  async function entfernen(r: Route) {
    if (!window.confirm(`Route „${r.name}“ löschen?`)) return;
    const { error } = await supabase.from('pirschwege').update({ geloescht_am: new Date().toISOString() }).eq('id', r.id);
    setFehler(error ? fehlertext(error) : null);
    await alleNeu();
  }
  function aufKarte(r: Route) {
    try {
      sessionStorage.setItem(ROUTENFOKUS, JSON.stringify({ id: r.id, geometry: r.geometry, typ: r.typ, name: r.name }));
    } catch {
      /* ohne Fokus */
    }
    navigieren('/karte');
  }
  async function zufallsfarben(liste: Route[]) {
    const farben = zufallsFarben(liste.length);
    const res = await Promise.all(liste.map((r, i) => supabase.from('pirschwege').update({ farbe: farben[i]! }).eq('id', r.id)));
    const fehl = res.find((x) => x.error)?.error;
    setFehler(fehl ? fehlertext(fehl) : null);
    await alleNeu();
  }
  async function reihenfolge(i: number, richtung: -1 | 1) {
    const a = ebenen[i];
    const b = ebenen[i + richtung];
    if (!a || !b) return;
    await Promise.all(ebenen.map((e, idx) => {
      const ziel = idx === i ? i + richtung : idx === i + richtung ? i : idx;
      return e.reihenfolge === ziel ? null : supabase.from('routen_ebenen').update({ reihenfolge: ziel }).eq('id', e.id);
    }));
    await ebenenLaden();
  }

  return (
    <>
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      {gruppen.length > 1 && (
        <div className="zonen-alle">
          <button className="link" onClick={() => setZu(new Set())}>
            Alle aufklappen
          </button>
          <button className="link" onClick={() => setZu(new Set(gruppen.map((g) => g.ebene?.id ?? 'ohne')))}>
            Alle zuklappen
          </button>
        </div>
      )}
      {gruppen.map(({ ebene, routen: liste }, gi) => {
        const gid = ebene?.id ?? 'ohne';
        const offen = !zu.has(gid);
        return (
          <section className="gruppe" key={gid}>
            <div className="gruppe-kopf">
              <button className="gruppe-toggle" aria-expanded={offen} onClick={() => umschalten(gid)}>
                <span aria-hidden="true">
                  <Symbol name={offen ? 'runter' : 'ausklappen'} className="symbol klein" />
                </span>
                {ebene && <i className="farbpunkt" style={{ background: ebene.farbe ?? routenTypFarbe(ebene.typ) }} />}
                <span className="gruppe-titel" style={{ margin: 0 }}>
                  {`${ebene ? ebene.name : ebenen.length ? 'Ohne Ebene' : 'Routen'} · ${liste.length}`}
                </span>
              </button>
              {k.istInhaber && liste.length > 0 && (
                <button className="link" onClick={() => void zufallsfarben(liste)} title="Weist jeder Route dieser Ebene eine andere, zufällige Farbe zu">
                  Zufallsfarben
                </button>
              )}
              {k.istInhaber && ebene && (
                <span className="zeile-aktionen">
                  <button className="link" onClick={() => void reihenfolge(gi, -1)} disabled={gi === 0} aria-label="Ebene nach oben">
                    ↑
                  </button>
                  <button className="link" onClick={() => void reihenfolge(gi, 1)} disabled={gi >= ebenen.length - 1} aria-label="Ebene nach unten">
                    ↓
                  </button>
                </span>
              )}
            </div>
            {offen && (
              <div className="gruppe-inhalt">
                {!laedt && liste.length === 0 && <Zeile label="Noch keine Routen in dieser Ebene" />}
                {liste.map((r) => {
                  const farbe = r.farbe ?? ebene?.farbe ?? routenTypFarbe(r.typ);
                  const passend = ebenen.filter((e) => e.typ === r.typ);
                  return (
                    <Zeile
                      key={r.id}
                      label={
                        <span className="zone-name">
                          {k.istInhaber ? (
                            <Farbwahl wert={farbe} label={`Farbe der Route ${r.name}`} onAendern={(f) => void farbeSetzen(r, f)} />
                          ) : (
                            <i className="farbpunkt" style={{ background: farbe }} />
                          )}
                          {r.name}
                          <small>
                            <span className="badge">{routenTypLabel(r.typ)}</span> {kmText(r.laengeM)}
                            {r.typ === 'treiberroute' && r.jagdOffen === false ? ' · Jagd abgeschlossen' : ''}
                          </small>
                        </span>
                      }
                    >
                      <span className="zeile-aktionen">
                        {k.istInhaber && passend.length > 0 && (
                          <select className="zeile-auswahl" aria-label={`Ebene von ${r.name}`} value={r.ebeneId ?? ''} onChange={(e) => void ebeneZuweisen(r, e.target.value)}>
                            <option value="">Ohne Ebene</option>
                            {passend.map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.name}
                              </option>
                            ))}
                          </select>
                        )}
                        <button className="link" onClick={() => aufKarte(r)}>
                          Auf Karte zeigen
                        </button>
                        {k.istInhaber && (
                          <>
                            <button className="link" onClick={() => void umbenennen(r)}>
                              Bearbeiten
                            </button>
                            <button className="link gefahr" onClick={() => void entfernen(r)}>
                              Löschen
                            </button>
                          </>
                        )}
                      </span>
                    </Zeile>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
      {k.istInhaber ? <RoutenEbenen k={k} ebenen={ebenen} routen={routen} onGeaendert={alleNeu} /> : <Leer>Routenebenen anlegen und ändern kann nur der Revierinhaber.</Leer>}
      <Knopf variante="sekundaer" onClick={() => navigieren('/karte')}>
        Routen auf der Karte zeichnen
      </Knopf>
    </>
  );
}

function RoutenEbenen({ k, ebenen, routen, onGeaendert }: { k: RevierKontext; ebenen: RoutenEbene[]; routen: Route[]; onGeaendert: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [typ, setTyp] = useState<RouteTyp>('pirschweg');
  const [fehler, setFehler] = useState<string | null>(null);
  const doppelt = name.trim() !== '' && nameVergeben(ebenen.map((e) => e.name), name);

  async function anlegen(e: FormEvent) {
    e.preventDefault();
    if (doppelt) return;
    setFehler(null);
    const { error } = await supabase.from('routen_ebenen').insert({
      revier_id: k.revierId,
      name: name.trim(),
      typ,
      reihenfolge: ebenen.length,
      wte_aktiv: typ === 'wte_route',
      farbe: ZONENFARBEN[(ebenen.length + 2) % ZONENFARBEN.length],
    });
    if (error) setFehler(error.code === '23505' ? `Eine Ebene „${name.trim()}“ gibt es bereits.` : fehlertext(error));
    else setName('');
    await onGeaendert();
  }

  async function aendern(ebene: RoutenEbene, werte: { name?: string; farbe?: string; wte_aktiv?: boolean }) {
    setFehler(null);
    if (werte.name !== undefined) {
      if (!werte.name.trim()) return;
      if (nameVergeben(ebenen.map((x) => x.name), werte.name, ebene.name)) return setFehler(`Eine Ebene „${werte.name.trim()}“ gibt es bereits.`);
    }
    const { error } = await supabase.from('routen_ebenen').update(werte).eq('id', ebene.id);
    // Eine neu gesetzte Ebenenfarbe überschreibt die Farben ihrer Routen (wie bei den Zonen)
    if (!error && werte.farbe) await supabase.from('pirschwege').update({ farbe: werte.farbe }).eq('ebene_id', ebene.id);
    if (error) setFehler(fehlertext(error));
    await onGeaendert();
  }

  async function loeschen(ebene: RoutenEbene, mitRouten: boolean) {
    const anzahl = routen.filter((r) => r.ebeneId === ebene.id).length;
    if (mitRouten) {
      const eingabe = window.prompt(`Ebene „${ebene.name}“ samt ${anzahl} Routen löschen? Zur Bestätigung LÖSCHEN eintippen:`);
      if (eingabe?.trim() !== 'LÖSCHEN') return;
    } else {
      const frage = anzahl ? `Ebene „${ebene.name}“ löschen? Die ${anzahl} Routen darin bleiben erhalten und sind danach ohne Ebene.` : `Ebene „${ebene.name}“ löschen?`;
      if (!window.confirm(frage)) return;
    }
    const { error } = await supabase.rpc('routen_ebene_loeschen', { p_ebene_id: ebene.id, p_mit_routen: mitRouten });
    if (error) setFehler(fehlertext(error));
    await onGeaendert();
  }

  return (
    <>
      <Gruppe
        titel="Routenebenen"
        fuss="Eine Ebene enthält nur einen Routentyp. Die Ebenenfarbe wird auf alle Routen der Ebene angewendet; danach kannst du einzelne Routen abweichend einfärben. Mit „WTE“ markierte Ebenen sind im WTE-Modus der Karte sichtbar. Treiberroute-Ebenen zeigen auf der Karte nur Routen offener Jagden."
      >
        {ebenen.length === 0 && <Zeile label="Noch keine Ebenen angelegt" />}
        {ebenen.map((e) => (
          <Zeile
            key={e.id}
            label={
              <span className="zone-name">
                <input type="color" className="farbwahl" aria-label={`Farbe der Ebene ${e.name}`} value={e.farbe ?? routenTypFarbe(e.typ)} onChange={(ev) => void aendern(e, { farbe: ev.target.value })} />
                {e.name}
                <small>
                  <span className="badge">{routenTypLabel(e.typ)}</span> {routen.filter((r) => r.ebeneId === e.id).length} Routen
                </small>
              </span>
            }
          >
            <span className="zeile-aktionen">
              {e.typ === 'wte_route' && (
                <label className="ebene" title="Routen dieser Ebene sind im WTE-Modus der Karte sichtbar">
                  <input type="checkbox" checked={e.wte_aktiv} onChange={(ev) => void aendern(e, { wte_aktiv: ev.target.checked })} /> WTE
                </label>
              )}
              <button
                className="link"
                onClick={() => {
                  const neu = window.prompt('Neuer Name der Ebene:', e.name);
                  if (neu && neu.trim() !== e.name) void aendern(e, { name: neu.trim() });
                }}
              >
                Umbenennen
              </button>
              <button className="link gefahr" onClick={() => void loeschen(e, false)}>
                Löschen
              </button>
              {routen.some((r) => r.ebeneId === e.id) && (
                <button className="link gefahr" onClick={() => void loeschen(e, true)}>
                  Samt Routen löschen
                </button>
              )}
            </span>
          </Zeile>
        ))}
      </Gruppe>
      <form onSubmit={anlegen}>
        <Gruppe>
          <Feld label="Neue Ebene" placeholder="z. B. Pirschwege Nord" value={name} onChange={(e) => setName(e.target.value)} />
          <Auswahl label="Routentyp" value={typ} onChange={(e) => setTyp(e.target.value as RouteTyp)}>
            {ROUTENTYPEN.map((t) => (
              <option key={t.wert} value={t.wert}>
                {t.label}
              </option>
            ))}
          </Auswahl>
        </Gruppe>
        {doppelt && <Hinweis art="fehler">Eine Ebene „{name.trim()}“ gibt es bereits.</Hinweis>}
        {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
        <Knopf type="submit" variante="sekundaer" disabled={!name.trim() || doppelt}>
          Ebene anlegen
        </Knopf>
      </form>
    </>
  );
}

export { freierName };
