import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { useWildarten } from '../../lib/stammdaten';
import { Gruppe, Hinweis, Seite, Zeile } from '../../components/ui';
import type { RevierKontext } from './kontext';

export function Freigaben({ k }: { k: RevierKontext }) {
  const wildarten = useWildarten();
  const [freigegeben, setFreigegeben] = useState<Set<string>>(new Set());
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const { data, error } = await supabase.from('freigaben').select('wildart_id').eq('revier_id', k.revierId);
    if (error) setFehler(fehlertext(error));
    setFreigegeben(new Set((data ?? []).map((f) => f.wildart_id)));
  }, [k.revierId]);

  useEffect(() => {
    void laden();
  }, [laden]);

  async function umschalten(wildartId: string, an: boolean) {
    setFehler(null);
    // Optimistisch umschalten
    setFreigegeben((alt) => {
      const neu = new Set(alt);
      if (an) neu.add(wildartId);
      else neu.delete(wildartId);
      return neu;
    });
    const { error } = an
      ? await supabase.from('freigaben').insert({ revier_id: k.revierId, wildart_id: wildartId })
      : await supabase.from('freigaben').delete().eq('revier_id', k.revierId).eq('wildart_id', wildartId);
    if (error) {
      setFehler(fehlertext(error));
      await laden();
    }
  }

  const gruppen = useMemo(() => {
    const m = new Map<string, typeof wildarten>();
    for (const w of wildarten) m.set(w.gruppe, [...(m.get(w.gruppe) ?? []), w]);
    return [...m.entries()];
  }, [wildarten]);

  return (
    <Seite titel="Freigaben" untertitel={`${freigegeben.size} von ${wildarten.length} Wildarten freigegeben`}>
      <Hinweis>
        Freigegeben werden nur Zählergebnisse und Abschüsse – keine Koordinaten, Grenzen oder Einrichtungen. Im
        Quervergleich siehst du von anderen Revieren nur die Wildarten, die du selbst freigibst.
      </Hinweis>
      {!k.istInhaber && <Hinweis>Nur der Revierinhaber kann Freigaben ändern.</Hinweis>}
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}

      {gruppen.map(([gruppe, liste]) => (
        <Gruppe key={gruppe} titel={gruppe}>
          {liste.map((w) => (
            <Zeile key={w.id} label={w.name}>
              <label className="schalter">
                <span className="visuell-versteckt">{w.name} freigeben</span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={freigegeben.has(w.id)}
                  disabled={!k.istInhaber}
                  onChange={(e) => umschalten(w.id, e.target.checked)}
                />
                <span aria-hidden="true" />
              </label>
            </Zeile>
          ))}
        </Gruppe>
      ))}
    </Seite>
  );
}
