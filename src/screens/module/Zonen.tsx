import { useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { useZonen, ZONENFARBEN, type Zone } from '../../lib/stammdaten';
import { navigieren } from '../../lib/router';
import { Feld, Gruppe, Hinweis, Knopf, Leer, Seite, Zeile } from '../../components/ui';
import type { RevierKontext } from './kontext';

export function Zonen({ k }: { k: RevierKontext }) {
  const { zonen, laedt, laden } = useZonen(k.revierId);
  const [name, setName] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);

  async function anlegen(e: FormEvent) {
    e.preventDefault();
    setFehler(null);
    const { error } = await supabase.from('zonen').insert({
      revier_id: k.revierId,
      name: name.trim(),
      sortierung: zonen.length,
      farbe: ZONENFARBEN[zonen.length % ZONENFARBEN.length],
    });
    if (error) setFehler(fehlertext(error));
    else setName('');
    await laden();
  }

  async function umbenennen(z: Zone) {
    const neu = window.prompt('Neuer Name der Zone:', z.name)?.trim();
    if (!neu || neu === z.name) return;
    const { error } = await supabase.from('zonen').update({ name: neu }).eq('id', z.id);
    if (error) setFehler(fehlertext(error));
    await laden();
  }

  async function verschieben(index: number, richtung: -1 | 1) {
    const ziel = index + richtung;
    const a = zonen[index];
    const b = zonen[ziel];
    if (!a || !b) return;
    await Promise.all([
      supabase.from('zonen').update({ sortierung: ziel }).eq('id', a.id),
      supabase.from('zonen').update({ sortierung: index }).eq('id', b.id),
    ]);
    await laden();
  }

  async function entfernen(z: Zone) {
    if (!window.confirm(`Zone „${z.name}“ entfernen? Bisherige Zählungen bleiben erhalten.`)) return;
    // Weiches Löschen, damit Historie und Offline-Geräte konsistent bleiben
    const { error } = await supabase.from('zonen').update({ geloescht_am: new Date().toISOString() }).eq('id', z.id);
    if (error) setFehler(fehlertext(error));
    await laden();
  }

  return (
    <Seite titel="Zonen" untertitel="Erfassungszonen für Zählung und Auswertung">
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}

      <Gruppe
        titel={`${zonen.length} Zonen`}
        fuss="Die Fläche einer Zone zeichnest du auf der Karte. Zählen funktioniert auch ohne gezeichnete Fläche."
      >
        {!laedt && zonen.length === 0 && <Zeile label="Noch keine Zonen angelegt" />}
        {zonen.map((z, i) => (
          <Zeile
            key={z.id}
            label={
              <span className="zone-name">
                <i className="farbpunkt" style={{ background: z.farbe ?? 'var(--akzent)' }} />
                {z.name}
                <small>{z.hatGeometrie ? 'Fläche gezeichnet' : 'ohne Fläche'}</small>
              </span>
            }
          >
            {k.istInhaber && (
              <span className="zeile-aktionen">
                <button className="link" onClick={() => verschieben(i, -1)} disabled={i === 0} aria-label="Nach oben">
                  ↑
                </button>
                <button className="link" onClick={() => verschieben(i, 1)} disabled={i === zonen.length - 1} aria-label="Nach unten">
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
      </Gruppe>

      {k.istInhaber ? (
        <form onSubmit={anlegen}>
          <Gruppe titel="Zone anlegen">
            <Feld label="Name" placeholder="z. B. Feldmark Nord" required value={name} onChange={(e) => setName(e.target.value)} />
          </Gruppe>
          <Knopf type="submit" variante="sekundaer" disabled={!name.trim()}>
            Zone anlegen
          </Knopf>
        </form>
      ) : (
        <Leer>Zonen anlegen und ändern kann nur der Revierinhaber.</Leer>
      )}

      <Knopf variante="sekundaer" onClick={() => navigieren('/karte')}>
        Zonen auf der Karte zeichnen
      </Knopf>
    </Seite>
  );
}
