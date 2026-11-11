import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { fehlertext } from '../lib/fehler';
import { Feld, Gruppe, Hinweis, Knopf, Zeile } from '../components/ui';
import { EinladungErstellen } from './MitgliederPanel';

type BetriebZeile = {
  id: string;
  name: string;
  flaeche_ha: number | null;
  inhaber: string[];
  mitglieder: number;
  selbstMitglied: boolean;
};

// Masteradmin: Forstbetriebe anlegen, Inhaber einladen, Betriebe löschen.
// Fachdaten der Betriebe sind für den Masteradmin per RLS nicht sichtbar –
// außer in Betrieben, in denen er selbst Mitglied ist.
export function AdminPanel({
  eigeneId,
  onGeaendert,
}: {
  eigeneId: string;
  onGeaendert: (betriebId?: string) => Promise<void>;
}) {
  const [betriebe, setBetriebe] = useState<BetriebZeile[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [einladenFuer, setEinladenFuer] = useState<string | null>(null);
  // Bestätigung im Formular statt window.prompt (im Artefakt-Viewer und auf manchen Geräten gesperrt)
  const [loeschen, setLoeschen] = useState<{ id: string; name: string; eingabe: string } | null>(null);

  const laden = useCallback(async () => {
    const { data, error } = await supabase
      .from('betriebe')
      .select('id, name, flaeche_ha, betrieb_mitglieder(user_id, rolle, profiles(name))')
      .order('name');
    if (error) setFehler(fehlertext(error));
    setBetriebe(
      (data ?? []).map((b) => ({
        id: b.id,
        name: b.name,
        flaeche_ha: b.flaeche_ha,
        inhaber: b.betrieb_mitglieder.filter((m) => m.rolle === 'inhaber').map((m) => m.profiles?.name ?? '?'),
        mitglieder: b.betrieb_mitglieder.length,
        selbstMitglied: b.betrieb_mitglieder.some((m) => m.user_id === eigeneId),
      })),
    );
  }, [eigeneId]);

  useEffect(() => {
    void laden();
  }, [laden]);

  // Masteradmin trägt sich selbst als Inhaber ein: Einladung erzeugen und sofort einlösen
  async function selbstEintragen(b: BetriebZeile) {
    setFehler(null);
    const erstellt = await supabase.rpc('einladung_erstellen', { p_betrieb_id: b.id, p_rolle: 'inhaber', p_gueltig_tage: 1 });
    if (erstellt.error || !erstellt.data) {
      setFehler(fehlertext(erstellt.error ?? 'Einladung konnte nicht erstellt werden.'));
      return;
    }
    const eingeloest = await supabase.rpc('einladung_einloesen', { p_code: erstellt.data });
    if (eingeloest.error) {
      setFehler(fehlertext(eingeloest.error));
      return;
    }
    await laden();
    await onGeaendert(b.id);
  }

  async function betriebLoeschen() {
    if (!loeschen) return;
    setFehler(null);
    const { error } = await supabase.from('betriebe').delete().eq('id', loeschen.id);
    if (error) setFehler(fehlertext(error));
    setLoeschen(null);
    await laden();
    await onGeaendert();
  }

  return (
    <div className="admin">
      <h2 className="bereich-titel">Forstbetriebe</h2>
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}

      <Gruppe titel="Forstbetriebe">
        {betriebe.length === 0 && <Zeile label="Noch keine Forstbetriebe angelegt" />}
        {betriebe.map((b) => (
          <div key={b.id}>
            <Zeile
              label={
                <>
                  {b.name}
                  <small>
                    {b.flaeche_ha ? `${b.flaeche_ha.toLocaleString('de-DE')} ha · ` : ''}
                    {b.mitglieder} {b.mitglieder === 1 ? 'Mitglied' : 'Mitglieder'}
                    {b.inhaber.length ? ` · Inhaber: ${b.inhaber.join(', ')}` : ' · noch kein Inhaber'}
                  </small>
                </>
              }
            >
              {b.selbstMitglied ? (
                <span className="zeile-wert">Du bist Mitglied</span>
              ) : (
                <button className="link" onClick={() => selbstEintragen(b)}>
                  Mich als Inhaber eintragen
                </button>
              )}
              <button className="link" onClick={() => setEinladenFuer(einladenFuer === b.id ? null : b.id)}>
                Inhaber einladen
              </button>
              <button className="link gefahr" onClick={() => setLoeschen({ id: b.id, name: b.name, eingabe: '' })}>
                Löschen
              </button>
            </Zeile>
            {loeschen?.id === b.id && (
              <div className="eingerueckt">
                <Hinweis art="fehler">
                  „{b.name}“ endgültig löschen? Bestände, Flurstücke, Maßnahmen und Funde werden mitgelöscht. Zur Bestätigung den Namen eingeben.
                </Hinweis>
                <Feld label="Name des Betriebs" value={loeschen.eingabe} onChange={(e) => setLoeschen({ ...loeschen, eingabe: e.target.value })} />
                <Knopf variante="gefahr" disabled={loeschen.eingabe.trim() !== b.name} onClick={() => void betriebLoeschen()}>
                  Endgültig löschen
                </Knopf>
                <Knopf variante="ghost" onClick={() => setLoeschen(null)}>
                  Abbrechen
                </Knopf>
              </div>
            )}
            {einladenFuer === b.id && (
              <div className="eingerueckt">
                <EinladungErstellen betriebId={b.id} festeRolle="inhaber" titel={`Inhaber für ${b.name} einladen`} />
              </div>
            )}
          </div>
        ))}
      </Gruppe>

      <BetriebAnlegen
        onAngelegt={async (id) => {
          await laden();
          setEinladenFuer(id);
        }}
      />
    </div>
  );
}

function BetriebAnlegen({ onAngelegt }: { onAngelegt: (id: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [flaeche, setFlaeche] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    setFehler(null);
    const ha = flaeche.trim() ? Number(flaeche.replace(',', '.')) : null;
    if (ha !== null && (!Number.isFinite(ha) || ha <= 0)) {
      setFehler('Bitte eine gültige Fläche in Hektar angeben.');
      return;
    }
    const { data, error } = await supabase.from('betriebe').insert({ name: name.trim(), flaeche_ha: ha }).select('id').single();
    if (error) {
      setFehler(fehlertext(error));
      return;
    }
    setName('');
    setFlaeche('');
    await onAngelegt(data.id);
  }

  return (
    <form onSubmit={absenden}>
      <Gruppe titel="Forstbetrieb anlegen" fuss="Nach dem Anlegen kannst du direkt den Inhaber einladen oder dich selbst eintragen.">
        <Feld label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Feld label="Fläche (ha)" inputMode="decimal" placeholder="optional" value={flaeche} onChange={(e) => setFlaeche(e.target.value)} />
      </Gruppe>
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      <Knopf type="submit" variante="sekundaer">
        Forstbetrieb anlegen
      </Knopf>
    </form>
  );
}
