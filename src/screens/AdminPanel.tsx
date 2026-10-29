import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { fehlertext } from '../lib/fehler';
import { Auswahl, Feld, Gruppe, Hinweis, Knopf, Zeile } from '../components/ui';
import { EinladungErstellen } from './MitgliederPanel';

type Hegering = { id: string; name: string };
type RevierZeile = {
  id: string;
  name: string;
  flaeche_ha: number | null;
  hegering: string;
  inhaber: string[];
  mitglieder: number;
};

// Masteradmin: Hegeringe und Reviere anlegen, Inhaber einladen, Reviere löschen.
// Fachdaten der Reviere sind für den Masteradmin per RLS nicht sichtbar.
export function AdminPanel({ onGeaendert }: { onGeaendert: () => Promise<void> }) {
  const [hegeringe, setHegeringe] = useState<Hegering[]>([]);
  const [reviere, setReviere] = useState<RevierZeile[]>([]);
  const [einladenFuer, setEinladenFuer] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const [hr, rv] = await Promise.all([
      supabase.from('hegeringe').select('id, name').order('name'),
      supabase
        .from('reviere')
        .select('id, name, flaeche_ha, hegeringe(name), revier_mitglieder(rolle, profiles(name))')
        .order('name'),
    ]);
    const err = hr.error ?? rv.error;
    if (err) setFehler(fehlertext(err));
    setHegeringe(hr.data ?? []);
    setReviere(
      (rv.data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        flaeche_ha: r.flaeche_ha,
        hegering: r.hegeringe?.name ?? '–',
        inhaber: r.revier_mitglieder.filter((m) => m.rolle === 'inhaber').map((m) => m.profiles?.name ?? '?'),
        mitglieder: r.revier_mitglieder.length,
      })),
    );
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  async function revierLoeschen(r: RevierZeile) {
    const eingabe = window.prompt(
      `Revier „${r.name}“ endgültig löschen? Alle Zählungen, Abschüsse, Zonen und Einrichtungen werden mitgelöscht.\n\nZur Bestätigung den Reviernamen eingeben:`,
    );
    if (eingabe?.trim() !== r.name) return;
    setFehler(null);
    const { error } = await supabase.from('reviere').delete().eq('id', r.id);
    if (error) setFehler(fehlertext(error));
    await laden();
    await onGeaendert();
  }

  return (
    <div className="admin">
      <h2 className="bereich-titel">Masteradmin</h2>
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}

      <Gruppe titel="Reviere">
        {reviere.length === 0 && <Zeile label="Noch keine Reviere angelegt" />}
        {reviere.map((r) => (
          <div key={r.id}>
            <Zeile
              label={
                <>
                  {r.name}
                  <small>
                    {r.hegering}
                    {r.flaeche_ha ? ` · ${r.flaeche_ha.toLocaleString('de-DE')} ha` : ''} · {r.mitglieder}{' '}
                    {r.mitglieder === 1 ? 'Mitglied' : 'Mitglieder'}
                    {r.inhaber.length ? ` · Inhaber: ${r.inhaber.join(', ')}` : ' · noch kein Inhaber'}
                  </small>
                </>
              }
            >
              <button className="link" onClick={() => setEinladenFuer(einladenFuer === r.id ? null : r.id)}>
                Inhaber einladen
              </button>
              <button className="link gefahr" onClick={() => revierLoeschen(r)}>
                Löschen
              </button>
            </Zeile>
            {einladenFuer === r.id && (
              <div className="eingerueckt">
                <EinladungErstellen revierId={r.id} festeRolle="inhaber" titel={`Inhaber für ${r.name} einladen`} />
              </div>
            )}
          </div>
        ))}
      </Gruppe>

      <RevierAnlegen
        hegeringe={hegeringe}
        onAngelegt={async (id) => {
          await laden();
          setEinladenFuer(id);
        }}
      />
      <HegeringAnlegen onAngelegt={laden} />
    </div>
  );
}

function RevierAnlegen({
  hegeringe,
  onAngelegt,
}: {
  hegeringe: Hegering[];
  onAngelegt: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [hegeringId, setHegeringId] = useState('');
  const [flaeche, setFlaeche] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    if (!hegeringId && hegeringe[0]) setHegeringId(hegeringe[0].id);
  }, [hegeringe, hegeringId]);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    setFehler(null);
    const ha = flaeche.trim() ? Number(flaeche.replace(',', '.')) : null;
    if (ha !== null && (!Number.isFinite(ha) || ha <= 0)) {
      setFehler('Bitte eine gültige Fläche in Hektar angeben.');
      return;
    }
    const { data, error } = await supabase
      .from('reviere')
      .insert({ name: name.trim(), hegering_id: hegeringId, flaeche_ha: ha })
      .select('id')
      .single();
    if (error) {
      setFehler(fehlertext(error));
      return;
    }
    setName('');
    setFlaeche('');
    await onAngelegt(data.id);
  }

  if (hegeringe.length === 0) {
    return <Hinweis>Lege zuerst einen Hegering an, danach kannst du Reviere anlegen.</Hinweis>;
  }

  return (
    <form onSubmit={absenden}>
      <Gruppe titel="Revier anlegen" fuss="Nach dem Anlegen kannst du direkt den Inhaber/Pächter einladen.">
        <Feld label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Auswahl label="Hegering" value={hegeringId} onChange={(e) => setHegeringId(e.target.value)}>
          {hegeringe.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </Auswahl>
        <Feld label="Fläche (ha)" inputMode="decimal" placeholder="optional" value={flaeche} onChange={(e) => setFlaeche(e.target.value)} />
      </Gruppe>
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      <Knopf type="submit" variante="sekundaer">
        Revier anlegen
      </Knopf>
    </form>
  );
}

function HegeringAnlegen({ onAngelegt }: { onAngelegt: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    setFehler(null);
    const { error } = await supabase.from('hegeringe').insert({ name: name.trim() });
    if (error) {
      setFehler(fehlertext(error));
      return;
    }
    setName('');
    await onAngelegt();
  }

  return (
    <form onSubmit={absenden}>
      <Gruppe titel="Hegering anlegen">
        <Feld label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
      </Gruppe>
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      <Knopf type="submit" variante="sekundaer">
        Hegering anlegen
      </Knopf>
    </form>
  );
}
