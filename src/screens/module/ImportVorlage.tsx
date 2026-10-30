import { useMemo, useState } from 'react';
import { wildartFinden } from '../../lib/csv';
import { useZonenEbenen, type Zone } from '../../lib/stammdaten';
import { Auswahl, Gruppe, Knopf } from '../../components/ui';

export const HAUPTARTEN = ['Feldhase', 'Rehwild', 'Fuchs', 'Waschbär', 'Dachs', 'Schwarzwild', 'Rebhuhn', 'Waldschnepfe'];

const csvZelle = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

// Matrix-Vorlage: Zeilen = Zonen, Spalten = Wildarten (wie die gedruckte Zusammenfassung)
export function vorlageErzeugen(zonenNamen: string[], arten: string[]): string {
  const namen = zonenNamen.length ? zonenNamen : ['Fläche 1', 'Fläche 2'];
  const zeilen = [['Zone', ...arten], ...namen.map((n) => [n, ...arten.map(() => '')])];
  return zeilen.map((z) => z.map(csvZelle).join(';')).join('\r\n') + '\r\n';
}

export function VorlageGruppe({ revierId, zonen, wildarten }: { revierId: string; zonen: Zone[]; wildarten: Array<{ id: string; name: string }> }) {
  const { ebenen } = useZonenEbenen(revierId);
  const [ebeneId, setEbeneId] = useState('');
  const [extra, setExtra] = useState<string[]>([]);
  const haupt = useMemo(() => HAUPTARTEN.map((n) => wildartFinden(n, wildarten)).filter((x): x is string => !!x), [wildarten]);
  const gewaehlteZonen = zonen.filter((z) => (ebeneId ? z.ebeneId === ebeneId : true));
  const weitere = wildarten.filter((w) => !haupt.includes(w.id));

  function herunterladen() {
    const arten = [...haupt, ...extra].map((id) => wildarten.find((w) => w.id === id)?.name ?? id);
    const text = '﻿' + vorlageErzeugen(gewaehlteZonen.map((z) => z.name), arten);
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hegewerk-vorlage-zaehlung-matrix.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Gruppe
      titel="Vorlage für eine Zählung herunterladen"
      fuss="Zeilen = Zonen, Spalten = Wildarten, wie in der gedruckten Zusammenfassung. Leere Zellen zählen als 0. Datum und Wetter gibst du beim Import an."
    >
      {ebenen.length > 0 && (
        <Auswahl label="Zonen" value={ebeneId} onChange={(e) => setEbeneId(e.target.value)}>
          <option value="">Alle Zonen des Reviers ({zonen.length})</option>
          {ebenen.map((e) => (
            <option key={e.id} value={e.id}>
              Zonenebene „{e.name}“ ({zonen.filter((z) => z.ebeneId === e.id).length})
            </option>
          ))}
        </Auswahl>
      )}
      {weitere.length > 0 && (
        <Auswahl
          label="Weitere Wildart ergänzen"
          value=""
          onChange={(e) => {
            const id = e.target.value;
            if (id && !extra.includes(id)) setExtra([...extra, id]);
          }}
        >
          <option value="">– auswählen –</option>
          {weitere.filter((w) => !extra.includes(w.id)).map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Auswahl>
      )}
      {extra.length > 0 && (
        <p className="gruppe-fuss">
          Zusätzlich:{' '}
          {extra.map((id) => (
            <button key={id} type="button" className="link" onClick={() => setExtra(extra.filter((x) => x !== id))} aria-label="Wildart wieder entfernen">
              {wildarten.find((w) => w.id === id)?.name} ✕{' '}
            </button>
          ))}
        </p>
      )}
      <Knopf variante="sekundaer" onClick={herunterladen}>
        Vorlage herunterladen
      </Knopf>
    </Gruppe>
  );
}
