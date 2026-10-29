import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { nameVergeben, useZonen, useZonenEbenen, zufallsFarben, ZONENFARBEN, type Zone, type ZonenEbene } from '../../lib/stammdaten';
import { navigieren } from '../../lib/router';
import { Auswahl, Farbwahl, Feld, Gruppe, Hinweis, Knopf, Leer, Seite, Zeile } from '../../components/ui';
import type { RevierKontext } from './kontext';

export function Zonen({ k }: { k: RevierKontext }) {
  const { zonen, laedt, laden } = useZonen(k.revierId);
  const { ebenen, laden: ebenenLaden } = useZonenEbenen(k.revierId);
  const [fehler, setFehler] = useState<string | null>(null);
  // eingeklappte Gruppen (je Gerät gemerkt)
  const [zu, setZu] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('hegewerk.zonen.zu') ?? '[]') as string[]);
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('hegewerk.zonen.zu', JSON.stringify([...zu]));
    } catch {
      /* nur für diese Sitzung */
    }
  }, [zu]);
  const umschalten = (id: string) =>
    setZu((alt) => {
      const neu = new Set(alt);
      if (neu.has(id)) neu.delete(id);
      else neu.add(id);
      return neu;
    });

  // Zonen nach Ebene gruppieren; „Ohne Ebene“ zuletzt
  const gruppen = useMemo(() => {
    const liste: Array<{ ebene: ZonenEbene | null; zonen: Zone[] }> = ebenen.map((e) => ({
      ebene: e,
      zonen: zonen.filter((z) => z.ebeneId === e.id),
    }));
    const ohne = zonen.filter((z) => !z.ebeneId || !ebenen.some((e) => e.id === z.ebeneId));
    if (ohne.length || ebenen.length === 0) liste.push({ ebene: null, zonen: ohne });
    return liste;
  }, [zonen, ebenen]);

  async function zufallsfarben(liste: Zone[]) {
    const farben = zufallsFarben(liste.length);
    const ergebnisse = await Promise.all(liste.map((z, i) => supabase.from('zonen').update({ farbe: farben[i]! }).eq('id', z.id)));
    const fehl = ergebnisse.find((r) => r.error)?.error;
    setFehler(fehl ? fehlertext(fehl) : null);
    await laden();
  }

  async function alleNeuLaden() {
    await Promise.all([laden(), ebenenLaden()]);
  }

  async function umbenennen(z: Zone) {
    const neu = window.prompt('Neuer Name der Zone:', z.name)?.trim();
    if (!neu || neu === z.name) return;
    if (nameVergeben(zonen.map((x) => x.name), neu, z.name)) {
      setFehler(`Eine Zone „${neu}“ gibt es in diesem Revier bereits.`);
      return;
    }
    const { error } = await supabase.from('zonen').update({ name: neu }).eq('id', z.id);
    setFehler(error ? fehlertext(error) : null);
    await laden();
  }

  async function farbeSetzen(z: Zone, farbe: string) {
    const { error } = await supabase.from('zonen').update({ farbe }).eq('id', z.id);
    setFehler(error ? fehlertext(error) : null);
    await laden();
  }

  async function ebeneZuweisen(z: Zone, ebeneId: string) {
    const ebene = ebenen.find((e) => e.id === ebeneId);
    const { error } = await supabase
      .from('zonen')
      .update({ ebene_id: ebeneId || null, ...(ebene?.farbe ? { farbe: ebene.farbe } : {}) })
      .eq('id', z.id);
    setFehler(error ? fehlertext(error) : null);
    await laden();
  }

  async function verschieben(liste: Zone[], index: number, richtung: -1 | 1) {
    const a = liste[index];
    const b = liste[index + richtung];
    if (!a || !b) return;
    await Promise.all([
      supabase.from('zonen').update({ sortierung: b.sortierung }).eq('id', a.id),
      supabase.from('zonen').update({ sortierung: a.sortierung === b.sortierung ? b.sortierung + richtung : a.sortierung }).eq('id', b.id),
    ]);
    await laden();
  }

  async function entfernen(z: Zone) {
    if (!window.confirm(`Zone „${z.name}“ entfernen? Bisherige Zählungen bleiben erhalten.`)) return;
    // Weiches Löschen, damit Historie und Offline-Geräte konsistent bleiben
    const { error } = await supabase.from('zonen').update({ geloescht_am: new Date().toISOString() }).eq('id', z.id);
    setFehler(error ? fehlertext(error) : null);
    await laden();
  }

  return (
    <Seite titel="Zonen" untertitel="Erfassungszonen und individuelle Zonenebenen · Farbe je Zone über den Farbpunkt">
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
      {gruppen.map(({ ebene, zonen: liste }) => {
        const gid = ebene?.id ?? 'ohne';
        const offen = !zu.has(gid);
        return (
        <section className="gruppe" key={gid}>
          <div className="gruppe-kopf">
            <button className="gruppe-toggle" aria-expanded={offen} onClick={() => umschalten(gid)}>
              <span aria-hidden="true">{offen ? '▾' : '▸'}</span>
              {ebene && <i className="farbpunkt" style={{ background: ebene.farbe ?? 'var(--text-leise)' }} />}
              <span className="gruppe-titel" style={{ margin: 0 }}>
                {`${ebene ? ebene.name : ebenen.length ? 'Ohne Ebene' : 'Zonen'} · ${liste.length}`}
              </span>
            </button>
            {k.istInhaber && liste.length > 0 && (
              <button className="link" onClick={() => void zufallsfarben(liste)} title="Weist jeder Zone dieser Ebene eine andere, zufällige Farbe zu">
                Zufallsfarben
              </button>
            )}
          </div>
          {offen && <div className="gruppe-inhalt">
          {!laedt && liste.length === 0 && <Zeile label="Noch keine Zonen in dieser Ebene" />}
          {liste.map((z, i) => (
            <Zeile
              key={z.id}
              label={
                <span className="zone-name">
                  {k.istInhaber ? (
                    <Farbwahl
                      wert={z.farbe ?? ebene?.farbe ?? '#1e5c3a'}
                      label={`Farbe der Zone ${z.name}`}
                      onAendern={(f) => void farbeSetzen(z, f)}
                    />
                  ) : (
                    <i className="farbpunkt" style={{ background: z.farbe ?? ebene?.farbe ?? 'var(--akzent)' }} />
                  )}
                  {z.name}
                  <small>{z.hatGeometrie ? 'Fläche gezeichnet' : 'ohne Fläche'}</small>
                </span>
              }
            >
              {k.istInhaber && (
                <span className="zeile-aktionen">
                  {ebenen.length > 0 && (
                    <select
                      className="zeile-auswahl"
                      aria-label={`Ebene von ${z.name}`}
                      value={z.ebeneId ?? ''}
                      onChange={(e) => ebeneZuweisen(z, e.target.value)}
                    >
                      <option value="">Ohne Ebene</option>
                      {ebenen.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <button className="link" onClick={() => verschieben(liste, i, -1)} disabled={i === 0} aria-label="Nach oben">
                    ↑
                  </button>
                  <button className="link" onClick={() => verschieben(liste, i, 1)} disabled={i === liste.length - 1} aria-label="Nach unten">
                    ↓
                  </button>
                  <button className="link" onClick={() => umbenennen(z)}>
                    Umbenennen
                  </button>
                  <button className="link gefahr" onClick={() => entfernen(z)}>
                    Entfernen
                  </button>
                </span>
              )}
            </Zeile>
          ))}
          </div>}
        </section>
        );
      })}

      {k.istInhaber ? (
        <>
          <ZoneAnlegen k={k} zonen={zonen} ebenen={ebenen} onAngelegt={laden} />
          <Ebenen k={k} ebenen={ebenen} zonen={zonen} onGeaendert={alleNeuLaden} />
        </>
      ) : (
        <Leer>Zonen und Ebenen anlegen und ändern kann nur der Revierinhaber.</Leer>
      )}

      <Knopf variante="sekundaer" onClick={() => navigieren('/karte')}>
        Zonen auf der Karte zeichnen
      </Knopf>
    </Seite>
  );
}

function ZoneAnlegen({
  k,
  zonen,
  ebenen,
  onAngelegt,
}: {
  k: RevierKontext;
  zonen: Zone[];
  ebenen: ZonenEbene[];
  onAngelegt: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [ebeneId, setEbeneId] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const doppelt = name.trim() !== '' && nameVergeben(zonen.map((z) => z.name), name);

  async function anlegen(e: FormEvent) {
    e.preventDefault();
    if (doppelt) return;
    setFehler(null);
    const ebene = ebenen.find((x) => x.id === ebeneId);
    const { error } = await supabase.from('zonen').insert({
      revier_id: k.revierId,
      name: name.trim(),
      ebene_id: ebeneId || null,
      sortierung: zonen.length,
      farbe: ebene?.farbe ?? ZONENFARBEN[zonen.length % ZONENFARBEN.length],
    });
    if (error) setFehler(fehlertext(error));
    else setName('');
    await onAngelegt();
  }

  return (
    <form onSubmit={anlegen}>
      <Gruppe titel="Zone anlegen">
        <Feld label="Name" placeholder="z. B. Feldmark Nord" required value={name} onChange={(e) => setName(e.target.value)} />
        {ebenen.length > 0 && (
          <Auswahl label="Ebene" value={ebeneId} onChange={(e) => setEbeneId(e.target.value)}>
            <option value="">Ohne Ebene</option>
            {ebenen.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Auswahl>
        )}
      </Gruppe>
      {doppelt && <Hinweis art="fehler">Eine Zone „{name.trim()}“ gibt es in diesem Revier bereits.</Hinweis>}
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      <Knopf type="submit" variante="sekundaer" disabled={!name.trim() || doppelt}>
        Zone anlegen
      </Knopf>
    </form>
  );
}

function Ebenen({
  k,
  ebenen,
  zonen,
  onGeaendert,
}: {
  k: RevierKontext;
  ebenen: ZonenEbene[];
  zonen: Zone[];
  onGeaendert: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const doppelt = name.trim() !== '' && nameVergeben(ebenen.map((e) => e.name), name);

  async function anlegen(e: FormEvent) {
    e.preventDefault();
    if (doppelt) return;
    setFehler(null);
    const { error } = await supabase.from('zonen_ebenen').insert({
      revier_id: k.revierId,
      name: name.trim(),
      sortierung: ebenen.length,
      farbe: ZONENFARBEN[(ebenen.length + 2) % ZONENFARBEN.length],
    });
    if (error) setFehler(fehlertext(error));
    else setName('');
    await onGeaendert();
  }

  async function aendern(ebene: ZonenEbene, werte: { name?: string; farbe?: string }) {
    setFehler(null);
    if (werte.name !== undefined) {
      if (!werte.name.trim()) return;
      if (nameVergeben(ebenen.map((x) => x.name), werte.name, ebene.name)) {
        setFehler(`Eine Ebene „${werte.name.trim()}“ gibt es bereits.`);
        return;
      }
    }
    const { error } = await supabase.from('zonen_ebenen').update(werte).eq('id', ebene.id);
    if (!error && werte.farbe) {
      // Zonen der Ebene übernehmen die Ebenenfarbe
      await supabase.from('zonen').update({ farbe: werte.farbe }).eq('ebene_id', ebene.id);
    }
    if (error) setFehler(fehlertext(error));
    await onGeaendert();
  }

  async function loeschen(ebene: ZonenEbene) {
    const anzahl = zonen.filter((z) => z.ebeneId === ebene.id).length;
    const frage = anzahl
      ? `Ebene „${ebene.name}“ löschen? Die ${anzahl} Zonen darin bleiben erhalten und sind danach ohne Ebene.`
      : `Ebene „${ebene.name}“ löschen?`;
    if (!window.confirm(frage)) return;
    const { error } = await supabase.from('zonen_ebenen').delete().eq('id', ebene.id);
    if (error) setFehler(fehlertext(error));
    await onGeaendert();
  }

  return (
    <>
      <Gruppe
        titel="Zonenebenen"
        fuss="Die Ebenenfarbe wird auf alle Zonen der Ebene angewendet; danach kannst du einzelne Zonen wieder abweichend einfärben. Mit Ebenen legst du unabhängige Zoneneinteilungen an, z. B. „Zählzonen“ und „Ansitzbereiche“. Auf der Karte lässt sich jede Ebene einzeln ein- und ausblenden, eine Zählung kann auf eine Ebene beschränkt werden."
      >
        {ebenen.length === 0 && <Zeile label="Noch keine Ebenen angelegt" />}
        {ebenen.map((e) => (
          <Zeile
            key={e.id}
            label={
              <span className="zone-name">
                <input
                  type="color"
                  className="farbwahl"
                  aria-label={`Farbe der Ebene ${e.name}`}
                  value={e.farbe ?? '#1e5c3a'}
                  onChange={(ev) => void aendern(e, { farbe: ev.target.value })}
                />
                {e.name}
                <small>{zonen.filter((z) => z.ebeneId === e.id).length} Zonen</small>
              </span>
            }
          >
            <span className="zeile-aktionen">
              <button
                className="link"
                onClick={() => {
                  const neu = window.prompt('Neuer Name der Ebene:', e.name);
                  if (neu && neu.trim() !== e.name) void aendern(e, { name: neu.trim() });
                }}
              >
                Umbenennen
              </button>
              <button className="link gefahr" onClick={() => loeschen(e)}>
                Löschen
              </button>
            </span>
          </Zeile>
        ))}
      </Gruppe>
      <form onSubmit={anlegen}>
        <Gruppe>
          <Feld label="Neue Ebene" placeholder="z. B. Zählzonen" value={name} onChange={(e) => setName(e.target.value)} />
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
