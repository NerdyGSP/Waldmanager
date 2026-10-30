import { nameVergeben } from '../lib/stammdaten';
import { routenTypLabel, type RouteTyp, type RoutenEbene } from '../lib/routen';
import { Auswahl, Feld, Hinweis } from './ui';

// Zielebene für Routen: Auswahl gefiltert nach Routentyp, auf Wunsch mit „Neue Ebene anlegen“
export function RoutenEbenenWahl({
  typ,
  ebenen,
  ebeneId,
  neuerName,
  darfAnlegen,
  onAendern,
}: {
  typ: RouteTyp;
  ebenen: RoutenEbene[];
  ebeneId: string;
  neuerName: string;
  darfAnlegen: boolean;
  onAendern: (ebeneId: string, neuerName: string) => void;
}) {
  const passend = ebenen.filter((e) => e.typ === typ);
  if (!passend.length && !darfAnlegen) return null;
  const doppelt = ebeneId === '__neu' && !!neuerName.trim() && nameVergeben(ebenen.map((e) => e.name), neuerName) && !passend.some((e) => e.name.trim().toLowerCase() === neuerName.trim().toLowerCase());
  return (
    <>
      <Auswahl label={`Ebene (${routenTypLabel(typ)})`} value={ebeneId} onChange={(e) => onAendern(e.target.value, neuerName)}>
        <option value="">Ohne Ebene</option>
        {passend.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
        {darfAnlegen && <option value="__neu">+ Neue Ebene anlegen …</option>}
      </Auswahl>
      {ebeneId === '__neu' && <Feld label="Name der neuen Ebene" value={neuerName} onChange={(e) => onAendern(ebeneId, e.target.value)} />}
      {doppelt && <Hinweis art="fehler">Eine Ebene „{neuerName.trim()}“ gibt es bereits (anderer Routentyp).</Hinweis>}
    </>
  );
}

export const ebeneUngueltig = (ebeneId: string, neuerName: string) => ebeneId === '__neu' && !neuerName.trim();
