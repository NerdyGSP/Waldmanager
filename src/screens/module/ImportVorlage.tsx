import { useState } from 'react';
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
  const gewaehlteZonen = zonen.filter((z) => (ebeneId ? z.ebeneId === ebeneId : true));

  function herunterladen() {
    const arten = wildarten.map((w) => w.name); // alle Wildarten in der Reihenfolge der Auswahl
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
      fuss="Zeilen = Zonen, Spalten = alle Wildarten in der Reihenfolge der Auswahl. Leere Zellen zählen als 0. Datum und Wetter gibst du beim Import an."
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
      <Knopf variante="sekundaer" onClick={herunterladen}>
        Vorlage herunterladen
      </Knopf>
    </Gruppe>
  );
}
