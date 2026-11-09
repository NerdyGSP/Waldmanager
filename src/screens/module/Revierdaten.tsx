import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { Feld, Gruppe, Hinweis, Knopf } from '../../components/ui';

type Art = 'grenze' | 'zonen' | 'ebenen' | 'einrichtungen' | 'pirschwege' | 'routenebenen' | 'felder';
const ARTEN: Array<{ id: Art; tabelle: 'revier_grenzen' | 'zonen' | 'zonen_ebenen' | 'einrichtungen' | 'pirschwege' | 'routen_ebenen' | 'flaechen_ebenen'; titel: string; hinweis: string }> = [
  { id: 'grenze', tabelle: 'revier_grenzen', titel: 'Reviergrenze', hinweis: 'Die Revierfläche in ha bleibt unverändert, bis eine neue Grenze übernommen wird.' },
  { id: 'zonen', tabelle: 'zonen', titel: 'Zonen', hinweis: 'Zählwerte, Beobachtungen, Abschüsse und Wildschäden bleiben erhalten, verlieren aber ihre Zonenzuordnung.' },
  { id: 'ebenen', tabelle: 'zonen_ebenen', titel: 'Zonenebenen', hinweis: 'Die Ebene früherer Zählungen entfällt.' },
  { id: 'einrichtungen', tabelle: 'einrichtungen', titel: 'Einrichtungen', hinweis: 'Verknüpfungen in Abschüssen und Aufgaben werden entfernt.' },
  { id: 'pirschwege', tabelle: 'pirschwege', titel: 'Routen (Pirschwege, WTE- und Treiberrouten)', hinweis: '' },
  { id: 'routenebenen', tabelle: 'routen_ebenen', titel: 'Routenebenen', hinweis: 'Die Routen darin bleiben ohne Ebene erhalten; „Routen“ zusätzlich auswählen, um sie samt Ebene zu löschen.' },
  { id: 'felder', tabelle: 'flaechen_ebenen', titel: 'Feldgrenzen (Ebenen samt Schlägen)', hinweis: 'Alle Schläge der Ebenen werden gelöscht. Gemerkte Fruchtzuordnungen bleiben erhalten.' },
];

// Nur für Inhaber: Karten- und Flächendaten eines Reviers vollständig entfernen (z. B. vor einem neuen Import)
export function RevierdatenLoeschen({ revierId, onGeaendert }: { revierId: string; onGeaendert: () => Promise<void> | void }) {
  const [zahlen, setZahlen] = useState<Partial<Record<Art, number>>>({});
  const [auswahl, setAuswahl] = useState<Set<Art>>(new Set());
  const [bestaetigung, setBestaetigung] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ art: 'erfolg' | 'fehler'; text: string } | null>(null);

  const zaehlen = useCallback(async () => {
    const erg = await Promise.all(
      ARTEN.map(async (a) => {
        const { count } = await supabase.from(a.tabelle).select('*', { count: 'exact', head: true }).eq('revier_id', revierId);
        return [a.id, count ?? 0] as const;
      }),
    );
    setZahlen(Object.fromEntries(erg));
  }, [revierId]);
  useEffect(() => {
    void zaehlen();
  }, [zaehlen]);

  const umschalten = (id: Art) =>
    setAuswahl((alt) => {
      const neu = new Set(alt);
      if (neu.has(id)) neu.delete(id);
      else neu.add(id);
      return neu;
    });

  async function loeschen() {
    setLaeuft(true);
    setMeldung(null);
    const geloescht: string[] = [];
    try {
      // Zonen vor Ebenen und Routen vor Routenebenen, damit nichts mehr auf eine Ebene zeigt
      for (const a of ARTEN.filter((x) => auswahl.has(x.id))) {
        const { error, count } = await supabase.from(a.tabelle).delete({ count: 'exact' }).eq('revier_id', revierId);
        if (error) throw error;
        geloescht.push(`${(count ?? 0).toLocaleString('de-DE')} ${a.titel}`);
      }
      setMeldung({ art: 'erfolg', text: `Gelöscht: ${geloescht.join(', ')}.` });
      setAuswahl(new Set());
      setBestaetigung('');
      await onGeaendert();
    } catch (err) {
      setMeldung({ art: 'fehler', text: `Löschen abgebrochen${geloescht.length ? ` (bereits gelöscht: ${geloescht.join(', ')})` : ''}: ${fehlertext(err)}` });
    } finally {
      await zaehlen();
      setLaeuft(false);
    }
  }

  const bereit = auswahl.size > 0 && bestaetigung.trim().toUpperCase() === 'LÖSCHEN';
  return (
    <>
      {meldung && <Hinweis art={meldung.art}>{meldung.text}</Hinweis>}
      <Gruppe
        titel="Kartendaten des Reviers löschen"
        fuss="Zum Beispiel, um eine neue Reviergrenze mit Zonen neu hochzuladen (Datenimport). Das Löschen kann nicht rückgängig gemacht werden."
      >
        {ARTEN.map((a) => (
          <label key={a.id} className="zeile">
            <input type="checkbox" checked={auswahl.has(a.id)} onChange={() => umschalten(a.id)} disabled={laeuft || !zahlen[a.id]} />
            <span className="zeile-label">
              {a.titel}
              <small>
                {zahlen[a.id] === undefined ? 'wird gezählt …' : a.id === 'grenze' ? (zahlen[a.id] ? 'vorhanden' : 'nicht vorhanden') : `${zahlen[a.id]!.toLocaleString('de-DE')} vorhanden`}
                {a.hinweis && zahlen[a.id] ? ` · ${a.hinweis}` : ''}
              </small>
            </span>
          </label>
        ))}
        <button
          type="button"
          className="link"
          style={{ padding: '8px 16px' }}
          onClick={() => setAuswahl(new Set(ARTEN.filter((a) => zahlen[a.id]).map((a) => a.id)))}
          disabled={laeuft}
        >
          Alles auswählen
        </button>
        {auswahl.size > 0 && (
          <Feld
            label="Zur Bestätigung „LÖSCHEN“ eintippen"
            value={bestaetigung}
            onChange={(e) => setBestaetigung(e.target.value)}
            autoComplete="off"
            placeholder="LÖSCHEN"
          />
        )}
      </Gruppe>
      <Knopf variante="gefahr" disabled={!bereit || laeuft} onClick={() => void loeschen()}>
        {laeuft ? 'Löscht …' : auswahl.size ? `Ausgewählte Daten endgültig löschen (${auswahl.size})` : 'Daten zum Löschen auswählen'}
      </Knopf>
    </>
  );
}
