import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type WteRoute = { id: string; name: string; ebene: string };

// Alle WTE-Routen des Reviers aus WTE-relevanten Ebenen
export function useWteRouten(revierId: string, aktiv = true) {
  const [routen, setRouten] = useState<WteRoute[] | null>(null);
  useEffect(() => {
    if (!aktiv) return;
    let lebt = true;
    void supabase
      .from('pirschwege')
      .select('id, name, routen_ebenen!inner(name, wte_aktiv, reihenfolge)')
      .eq('revier_id', revierId)
      .eq('typ', 'wte_route')
      .eq('routen_ebenen.wte_aktiv', true)
      .is('geloescht_am', null)
      .order('name')
      .then(({ data }) => {
        if (!lebt) return;
        setRouten(
          (data ?? []).map((r) => ({ id: r.id, name: r.name, ebene: (r.routen_ebenen as unknown as { name: string }).name })),
        );
      });
    return () => {
      lebt = false;
    };
  }, [revierId, aktiv]);
  return routen;
}

// Auswahl der WTE-Routen einer Zählung (mehrfach nutzbar, eine Route kann zu beliebig vielen Zählungen gehören)
export function WteRoutenWahl({
  routen,
  gewaehlt,
  onAendern,
}: {
  routen: WteRoute[] | null;
  gewaehlt: string[];
  onAendern: (ids: string[]) => void;
}) {
  if (routen === null) return <p className="gruppe-fuss" style={{ margin: 0, padding: '4px var(--abstand)' }}>Routen werden geladen …</p>;
  if (routen.length === 0)
    return (
      <p className="gruppe-fuss" style={{ margin: 0, padding: '4px var(--abstand)' }}>
        Keine WTE-Routen vorhanden. Lege unter „Zonen &amp; Routen“ eine WTE-Ebene mit Routen an (Häkchen „WTE-relevant“) oder zeichne eine Route über „+ NEU“ auf der Karte.
      </p>
    );
  const alle = gewaehlt.length === routen.length;
  const umschalten = (id: string, an: boolean) => onAendern(an ? [...gewaehlt, id] : gewaehlt.filter((x) => x !== id));
  return (
    <div style={{ padding: '4px var(--abstand) 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: '0.9rem' }}>WTE-Routen dieser Zählung</strong>
        <button type="button" className="glocke-alle" onClick={() => onAendern(alle ? [] : routen.map((r) => r.id))}>
          {alle ? 'Keine' : 'Alle'}
        </button>
      </div>
      <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'grid', gap: 4 }}>
        {routen.map((r) => (
          <li key={r.id}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={gewaehlt.includes(r.id)} onChange={(e) => umschalten(r.id, e.target.checked)} />
              <span>
                {r.name} <small style={{ color: 'var(--text-leise)' }}>· {r.ebene}</small>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
