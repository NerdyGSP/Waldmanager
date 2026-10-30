import { EINRICHTUNGS_GRUPPEN } from '../lib/einrichtungsIcons';
import { EINRICHTUNGSTYPEN } from '../lib/stammdaten';
import type { Enums } from '../lib/database.types';

// Optionen für Auswahllisten, gruppiert (Ansitz · Revierpflege · Technik und Fang · Sonstiges).
// bockZuerst: Drückjagdbock steht vorn (Standzuweisung der Bewegungsjagd).
export function EinrichtungsOptionen({ zaehler, bockZuerst = false, nur }: { zaehler?: (typ: Enums<'einrichtung_typ'>) => number; bockZuerst?: boolean; nur?: (typ: Enums<'einrichtung_typ'>) => boolean }) {
  const opt = (wert: Enums<'einrichtung_typ'>) => {
    const t = EINRICHTUNGSTYPEN.find((x) => x.wert === wert);
    if (!t || (nur && !nur(wert))) return null;
    return (
      <option key={wert} value={wert}>
        {t.label}
        {zaehler ? ` (${zaehler(wert)})` : ''}
      </option>
    );
  };
  return (
    <>
      {bockZuerst && opt('drueckjagdbock')}
      {EINRICHTUNGS_GRUPPEN.map((g) => {
        const eintraege = g.typen.filter((t) => !(bockZuerst && t === 'drueckjagdbock')).map(opt).filter(Boolean);
        return eintraege.length ? (
          <optgroup key={g.name} label={g.name}>
            {eintraege}
          </optgroup>
        ) : null;
      })}
    </>
  );
}
