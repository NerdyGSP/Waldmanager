# Umbau aus Hegewerk – Stand

Ausgangspunkt: Hegewerk `main`, Stand 11.11.2026 (Commit `3d3d13a`). Supabase-Projekt „Waldmanager“ (`giwqfhatjdhguqnreggg`, eu-central-1).

| Paket | Inhalt | Stand |
| --- | --- | --- |
| 1 Entkernen und Basis | Jagdmodule entfernt; Auth, Einladung, Forstbetrieb, Mitglieder, Masteradmin, Einstellungen auf neuem Schema; Karte mit Betriebsgrenze und Beständen; Bestandsverwaltung mit Baumarten | erledigt (PR #1) |
| 2 Fachmodule | Modul Flurstücke mit Import aus SHP/GeoPackage (ALKIS-Felder werden erkannt), Grenze aus Flurstücken, Flurstücke als Kartenebene; Modul Maßnahmen mit Statusfilter, Überfälligkeit, Status per Klick, Formular; Maßnahmen im Bestandsdetail | erledigt (PR #2) |
| 3 Feld und Heatmap | Modul Funde mit Meldeformular (GPS, Bestand automatisch, Merkmal, Anzahl/fm, Foto) und Liste; Offline-Warteschlange für Funde, Fotos in IndexedDB bis zum Upload in den Bucket `fund-fotos`; Kartenebenen Funde und Heatmap (Kerndichte, gewichtet) mit Filter Fundtyp und Zeitraum, Schwerpunkte je Bestand | in Arbeit (Branch `umbau/3-feld-heatmap`) |
| Luftbilder NRW und Hessen | Luftbild-Ebene über eigenes Kachelprotokoll `luftbild://`: im Landesinneren ein Dienst (NI: LGLN, NW: Geobasis NRW, HE: HVBG; WMS in EPSG:3857, dl-de/zero-2.0), im Grenzstreifen (≈ 7 km) alle beteiligten Dienste als PNG übereinander; Vorrang automatisch nach Lage des Betriebs oder von Hand im Ebenen-Menü; Handy lädt Betriebsbereich + 1 km, Schalter „Luftbild für ganzen Ausschnitt“ je Gerät; Service Worker cacht die neuen Kachel-Hosts | erledigt (PR #5, #6, #7) |
| Waldwege aus OSM (Test) | Kartenebene „Waldwege (OSM)“ in der Gruppe Basiskarte, standardmäßig aus: Fahrwege (`highway=track`, Farbe nach `tracktype`) und Pfade/Reitwege gestrichelt. Einmal je Betrieb über die Overpass API geladen (grobes Rechteck: Betriebsausdehnung + 1 km, auf 0,02°-Raster gerundet; drei Instanzen als Ausweich), lokal auf Grenze bzw. Flurstücke/Bestände zugeschnitten, je Gerät 30 Tage im localStorage (auch offline). ODbL. Hintergrund: NavLog-Waldwegedaten nur mit Einzel-/Resellerlizenz | erledigt (PR #8, #9) |
| Polter | Modul „Polter“ (Holz am Weg): Erfassung per GPS oder Kartenklick mit Baumart, Stück oder fm, Notiz; Liste mit Liegedauer, Filter Liegt/Überfällig/Abgefahren, Status per Klick; Frist je Polter (Standard 28 Tage, Auswahl 1–13 Wochen, in der Liste änderbar); Kartenebene „Polter“ (liegende, überfällige rot) mit Infofenster; Offline-Warteschlange und Lese-Cache. Tabelle `polter`, RPC `polter_laden` (Migration `20261121120000_polter.sql`, angewendet am 21.11.2026). Frist je Polter: Spalte `frist_tage` (Migration `20261121130000_zonen_polterfrist.sql`). Noch offen: Foto, Löschen | erledigt (PR #11), Frist in Prüfung (Branch `feature/zonen-polterfrist`) |
| Zonen im Bestand | Tabelle `bestand_zonen` (Mitglieder lesen, Inhaber schreiben), RPC `zone_speichern` schneidet auf den Bestand zu; `massnahmen.zone_id` (Bestand wird aus der Zone ergänzt); `karte_daten` liefert Zonen mit Durchforstungsjahren (erledigte Durchforstungen, Jahr aus Termin). Karte: Ebene „Zonen“ nach Wuchsstadium (Kultur ≤ 5, Dickung ≤ 15, Stangenholz ≤ 40 J., Baumholz) mit Legende, „Zone einzeichnen“ im Bestandsfenster, Punkte am Bestandsrand einrasten, Zone bearbeiten, Infofenster. Bestandsdetail: Abschnitt Zonen mit Name, Pflanzjahr, Mischung, Bemerkung, Durchforstungen nachtragen, Entfernen. Maßnahmen: Auswahl Zone. Migration `20261121130000_zonen_polterfrist.sql` am 21.11.2026 angewendet | in Prüfung (Branch `feature/zonen-polterfrist`) |
| Z-Bäume | Erfassung als Erweiterung der Funde, eigene Kartenebene, nicht in der Heatmap (mit Benjamin abgestimmt) | geplant |

## Schema

Migrationen in `supabase/migrations/`. Tabellen: `betriebe`, `betrieb_mitglieder`, `einladungen`, `profiles`, `masteradmins`,
`betrieb_grenzen`, `flurstuecke`, `bestaende`, `massnahmen`, `funde`, `polter`, `bestand_zonen`. RLS: Mitglieder lesen, Inhaber schreiben Geodaten;
Maßnahmen, Funde und Polter dürfen alle Mitglieder anlegen.

## Bewusst weggelassen

Hegeringe, Wildarten, Jagdzeiten, Zählungen, Abschüsse, Bewegungsjagd, Pirschwege und Routen, Begehungsscheine,
Freigaben, Einrichtungen, Glocke/Ereignisse, Wetter und Wind, Brevo-Mailversand.

## Nach dem Umbau

Mögliche nächste Schritte: Holzerfassung (Polter, Mengen, Abfuhr), Statistik zu Maßnahmen und Funden, Maßnahme direkt
aus einem Fund anlegen, Benachrichtigung bei neuen Käferfunden.
