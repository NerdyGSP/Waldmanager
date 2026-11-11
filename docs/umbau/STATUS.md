# Umbau aus Hegewerk – Stand

Ausgangspunkt: Hegewerk `main`, Stand 11.11.2026 (Commit `3d3d13a`). Supabase-Projekt „Waldmanager“ (`giwqfhatjdhguqnreggg`, eu-central-1).

| Paket | Inhalt | Stand |
| --- | --- | --- |
| 1 Entkernen und Basis | Jagdmodule entfernt; Auth, Einladung, Forstbetrieb, Mitglieder, Masteradmin, Einstellungen auf neuem Schema; Karte mit Betriebsgrenze und Beständen; Bestandsverwaltung mit Baumarten | erledigt (PR #1) |
| 2 Fachmodule | Modul Flurstücke mit Import aus SHP/GeoPackage (ALKIS-Felder werden erkannt), Grenze aus Flurstücken, Flurstücke als Kartenebene; Modul Maßnahmen mit Statusfilter, Überfälligkeit, Status per Klick, Formular; Maßnahmen im Bestandsdetail | erledigt (PR #2) |
| 3 Feld und Heatmap | Modul Funde mit Meldeformular (GPS, Bestand automatisch, Merkmal, Anzahl/fm, Foto) und Liste; Offline-Warteschlange für Funde, Fotos in IndexedDB bis zum Upload in den Bucket `fund-fotos`; Kartenebenen Funde und Heatmap (Kerndichte, gewichtet) mit Filter Fundtyp und Zeitraum, Schwerpunkte je Bestand | in Arbeit (Branch `umbau/3-feld-heatmap`) |

## Schema

Migrationen in `supabase/migrations/`. Tabellen: `betriebe`, `betrieb_mitglieder`, `einladungen`, `profiles`, `masteradmins`,
`betrieb_grenzen`, `flurstuecke`, `bestaende`, `massnahmen`, `funde`. RLS: Mitglieder lesen, Inhaber schreiben Geodaten;
Maßnahmen und Funde dürfen alle Mitglieder anlegen.

## Bewusst weggelassen

Hegeringe, Wildarten, Jagdzeiten, Zählungen, Abschüsse, Bewegungsjagd, Pirschwege und Routen, Begehungsscheine,
Freigaben, Einrichtungen, Glocke/Ereignisse, Wetter und Wind, Brevo-Mailversand.

## Nach dem Umbau

Mögliche nächste Schritte: Holzerfassung (Polter, Mengen, Abfuhr), Statistik zu Maßnahmen und Funden, Maßnahme direkt
aus einem Fund anlegen, Benachrichtigung bei neuen Käferfunden.
