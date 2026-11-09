# Hegewerk-Rework

Umbau in sieben Phasen statt Neubau. Backend (Supabase, RLS, PostGIS), Fachlogik und Design bleiben. Neu werden
Bedienschicht, Kartenkern und Offline-Sync. Das ausführliche Konzept liegt als Dokument bei Claude
(„Hegewerk – Rework-Konzept: Workflow & Karten-Plattform“), die Kurzfassung im Projekt unter
`claude/hegewerk-rework-konzept.md`.

| Datei | Inhalt |
| --- | --- |
| [STATUS.md](STATUS.md) | Stand je Arbeitspaket, nächster Schritt, bekannte Lücken |
| [ARBEITSPAKETE.md](ARBEITSPAKETE.md) | Alle Arbeitspakete mit Dateien, Schritten und Abnahme |
| [ARCHITEKTUR.md](ARCHITEKTUR.md) | Zielbild: Bereiche, Kartenmodi, Kartenkern, Daten, Offline |
| [ENTSCHEIDUNGEN.md](ENTSCHEIDUNGEN.md) | Offene Entscheidungen und was bis dahin gilt |
| [ABNAHME-GERAETE.md](ABNAHME-GERAETE.md) | Checkliste für iPhone, iPad und Windows-Browser |
| [klickdummy/](klickdummy/LIESMICH.md) | Von Benjamin bestätigtes Zielbild der Oberfläche |

## So läuft ein Arbeitspaket

1. `STATUS.md` lesen und das nächste offene AP wählen, dessen Voraussetzungen erfüllt sind.
2. Branch `rework/<ap-nummer>-<kurzname>` von `main` anlegen.
3. Die im AP genannten Dateien lesen, dann umsetzen. Reicht der Umfang nicht für eine Sitzung, das AP teilen und
   die Teilung in `ARBEITSPAKETE.md` festhalten.
4. `npm run check` und `npm run build` müssen grün sein.
5. `STATUS.md` aktualisieren: AP abhaken, Datum, was geprüft wurde und was nicht.
6. Pull Request öffnen. Benjamin prüft auf einem Gerät und mergt.

## Vorlage für den Start einer Sitzung

> Lies `CLAUDE.md` und `docs/rework/STATUS.md`. Setze AP *x.y* aus `docs/rework/ARBEITSPAKETE.md` um, auf einem
> eigenen Branch, und öffne am Ende einen Pull Request. Halte dich an die Abnahmekriterien des AP und schreibe in
> den PR, was du geprüft hast und was nicht.

## Fertig heißt

- Abnahmekriterien des AP erfüllt
- Neue Fachlogik hat Unit-Tests, die CI ist grün
- Verhalten außerhalb des AP unverändert, Abweichungen stehen im PR
- Kein Zugriff auf Produktion ohne Freigabe; Migrationen liegen als Datei vor
- `STATUS.md` ist aktuell

## Welches Modell

Die Arbeitspakete tragen eine Empfehlung: **S** eignet sich für Sonnet (klar umrissen, mechanisch), **O** besser
für Opus (Architektur, Nebenläufigkeit, Datenbank mit Rechten, schwer rückholbar). Im Zweifel ein S-Paket weiter
teilen statt ein O-Paket mit dem kleineren Modell zu beginnen.
