# Arbeitspakete

Jedes Arbeitspaket (AP) ist für eine Sitzung und einen Pull Request gedacht. **S** = für Sonnet geeignet,
**O** = besser Opus. „Braucht“ nennt Voraussetzungen. Zeilenangaben zu `Karte.tsx` beziehen sich auf den Stand
des Branches `rework/fundament` und verschieben sich; suche nach den genannten Bezeichnern.

Phasen 1 bis 3 bauen aufeinander auf. Phasen 4 bis 6 lassen sich nach Bedarf tauschen.

---

## Phase 0 – Fundament

Abnahme der Phase: grüner Build in der CI, Staging mit Testrevier, Ausgangsmessung auf den Geräten liegt vor.

### 0.1 Vitest und Tests der Fachlogik · erledigt
Tests für `csv`, `zeit`, `fruchtgruppen`, `jagdzeiten`, `geo`.

### 0.2 CI · erledigt
`.github/workflows/ci.yml`: Typprüfung, Tests, Build je Branch und Pull Request.

### 0.3 Migrationen im Repository · teilweise erledigt · S
Die 53 Migrationen der Produktion liegen in `supabase/migrations/`. Offen:
- `supabase/config.toml` anlegen (`supabase init`, Projekt-ID eintragen), Edge Functions bleiben, wo sie sind.
- Auf einem Rechner mit Docker `supabase start` ausführen und prüfen, ob die Historie auf einer leeren Datenbank
  durchläuft. Fehler in einer Notiz `docs/rework/MIGRATIONEN.md` festhalten, die Historie selbst nicht umschreiben.
- Abnahme: `supabase db reset` läuft lokal fehlerfrei durch, oder die Abweichungen sind dokumentiert.
- Hinweis: In der Cloud-Sandbox gibt es kein Docker; dieses AP braucht Benjamins Rechner oder die CI.

### 0.4 Staging · braucht Benjamin · O
Zweites Supabase-Projekt „Hegewerk Staging“ (oder Supabase-Branching) mit Testrevier und Testnutzern.
- Migrationen einspielen, Stammdaten (`wildarten`, `jagdzeiten`) übernehmen, ein Testrevier mit Grenze, Zonen,
  Einrichtungen und Beispielzählungen anlegen. Keine echten Personendaten kopieren.
- Vorschau-Deployment je Branch bei Cloudflare prüfen und mit den Staging-Schlüsseln als Build-Variablen versehen.
- `CLAUDE.md` anpassen: Migrationen zuerst auf Staging, Produktion nach Freigabe.
- Abnahme: Ein Branch ist unter einer Vorschau-Adresse gegen Staging bedienbar.

### 0.5 End-to-End-Rauchtest mit Supabase-Mock · S
Playwright (liegt in der Sandbox vor) gegen `vite preview`, Supabase-Aufrufe per `page.route` beantwortet.
- Testdaten als JSON unter `e2e/daten/` (Sitzung, Revier, `karte_daten`, Wildarten).
- Fälle: Anmeldung gezeigt; nach Mock-Anmeldung lädt die Karte ohne Konsolenfehler; Ebenen-Panel schaltet eine
  Ebene; iPhone-Größe zeigt die Kachelübersicht.
- Skript `npm run e2e`, eigener CI-Job. Kartenkacheln im Test blockieren oder mit leerem Bild beantworten.
- Abnahme: Der Test schlägt fehl, wenn `Karte.tsx` beim Laden einen Fehler wirft. Dieses AP sichert Phase 1 ab.

### 0.6 Ausgangsmessung auf Geräten · braucht Benjamin
`ABNAHME-GERAETE.md` einmal vollständig auf iPhone, iPad und Windows-Firefox durchgehen, Ergebnisse dort eintragen.

### 0.7 Weitere Unit-Tests · S
`offline.ts` (Reihenfolge und Abhängigkeiten der Warteschlange; dazu die reine Logik von den Supabase-Aufrufen
trennen), `geoimport.ts`, `gpsParser.ts`, `gpsPruefung.ts`, `ics.ts`, `bewegungsjagd.ts`, `bjGruppen.ts`, `md3.ts`.
- Abnahme: Jede genannte Datei hat Tests für ihre Hauptpfade und mindestens einen Fehlerfall.

### 0.8 Schutz von `main` · braucht Benjamin
In GitHub: Pull Request und grüne CI als Bedingung für `main`.

---

## Phase 1 – Kartenkern

Abnahme der Phase: Die Karte ist auf iPhone, iPad und PC funktionsgleich zum Stand vor dem Rework, läuft als eine
Instanz, und eine neue Ebene entsteht ohne Änderung an `Karte.tsx`.

### 1.1 Registry, Einstellungen, Geometrie · erledigt
`src/karte/ebenen/registry.ts`, `einstellungen.ts`, `src/karte/kern/geometrie.ts`; `Karte.tsx` nutzt sie.

### 1.2 Schichten je Ebene auslagern · S · braucht 0.5
Heute legt der `load`-Handler in `Karte.tsx` (suche `m.on('load'`) alle Quellen und Schichten an.
- `EbenenDeklaration` um `anlegen(m: Map): void` erweitern (Quelle und Schichten), optional `bilder(m)`.
- Je Ebene eine Datei `src/karte/ebenen/<id>.ts` mit den Schicht-Spezifikationen, unverändert übernommen.
- `src/karte/ebenen/aufbau.ts`: `ebenenAnlegen(m)` geht die Registry von unten nach oben durch.
- Der `load`-Handler ruft nur noch `ebenenAnlegen(m)`; Zeichenschichten (`zeichnung-*`) bleiben vorerst dort.
- Abnahme: Rauchtest grün, Reihenfolge der Schichten laut `m.getStyle().layers` unverändert (im Test vergleichen).

### 1.3 Sichtbarkeit und Deckkraft deklarativ · S · braucht 1.2
Heute setzen zwei Effekte Sichtbarkeit und Deckkraft Schicht für Schicht (suche `setLayoutProperty` und `const setze =`).
- Deklaration je Schicht: welche Paint-Eigenschaft die Deckkraft trägt und mit welchem Faktor
  (z. B. `zonen-flaeche`: `fill-opacity` × 0,4; `zonen-linie`: `line-opacity` × 1,8, höchstens 1).
- `src/karte/ebenen/anwenden.ts`: `sichtbarkeitAnwenden(m, zustand, modus)` und `deckkraftAnwenden(m, einstellungen)`.
- Sonderfälle bleiben als benannte Funktionen bei ihrer Ebene: Routen-Deckkraft je Unterebene, WTE-Filter.
- Abnahme: Unit-Test mit einer Attrappe für `Map` prüft die gesetzten Werte gegen die heutigen Zahlen.

### 1.4 Eine Karteninstanz außerhalb von React · O · braucht 1.3
Heute erzeugt jede `Karte`-Komponente ihre eigene Instanz (`new KarteMap`); `Home.tsx` bindet sie an zwei Stellen
ein, auf dem iPhone wird sie beim Seitenwechsel neu aufgebaut.
- `src/karte/kern/karte.ts`: erzeugt die Instanz einmal, hängt ihren Container beim Einbinden um, räumt beim
  Abmelden und beim Revierwechsel auf.
- `Home.tsx`: ein dauerhafter Kartencontainer für beide Layouts; unter 900 px liegt er hinter den Modulseiten.
- Abnahme: Wechsel Karte → Modul → Karte behält Ausschnitt und Ebenen ohne Neuaufbau (Rauchtest zählt Instanzen).
- Risiko: Speicherlecks und doppelte Ereignisbehandlung. Ereignisse zentral im Kern registrieren.

### 1.5 Kartenmodi anschließen · O · braucht 1.4
`src/karte/modi/modi.ts` ist vorhanden, aber nicht angeschlossen.
- Zuordnung: `wte` → `zaehlen`; `modus.art` grenze, zone, route, aufzeichnung, einrichtung → `bearbeiten` mit
  Unterzustand; `sheetArt` bleibt Detail des Bearbeitens.
- Ein Store (`src/karte/kern/zustand.ts`, `useSyncExternalStore`, keine neue Bibliothek) hält Modus, Auswahl,
  Sichtbarkeit; `Karte.tsx` liest daraus.
- Sichtbarkeit je Modus kommt aus `imModusErlaubt`; der WTE-Sonderfall (nur WTE-aktive Zonen und Routen) bleibt.
- Abnahme: Zählmodus zeigt dieselben Ebenen wie heute; Mitjäger können nicht in `bearbeiten` wechseln.
- Prüfen: Die Regel „Druck nur für Inhaber in breiter Ansicht“ in `modusErlaubt` ist ein Vorschlag.

### 1.6 Kartenzustand in der URL · S · braucht 1.5
- `src/lib/router.ts`: `navigieren` vergleicht heute nur den Pfad. Query-Parameter erhalten und eine Funktion
  `sucheSetzen(search, ersetzen = true)` ergänzen; `usePfad` bleibt.
- Ausschnitt bei `moveend` gedrosselt per `replaceState` schreiben (`inUrl`), beim Start lesen (`ausUrl`).
- `hegewerk:kartenfokus` (Event und `sessionStorage`) durch `o=einrichtung:<id>` ersetzen; Glocke und
  Einrichtungstabelle erzeugen Links statt Events.
- Abnahme: Eine kopierte Adresse öffnet dieselbe Stelle mit demselben geöffneten Objekt.

### 1.7 `karte_daten` aufteilen · O · braucht 0.4 · Datenbank
Neun von zehn Aufrufern holen nur die Reviergrenze oder Stammdaten (`grep -rn karte_daten src`).
- Neue RPCs, jeweils mit `p_geaendert_seit timestamptz default null`: `revier_grenze`, `karte_zonen`,
  `karte_einrichtungen`, `karte_routen`, `karte_geschehen(p_tage)`. `karte_daten` bleibt bis zum Ende von Phase 3.
- Rechte wie `karte_daten` (Mitglieder des Reviers). In `offlineCache.ts` die Liste `LESENDE_RPC` ergänzen.
- Aufrufer umstellen: `PositionWaehlen`, `ereignisse`, `routen`, `Datenimport`, `Einrichtungstabelle`,
  `FeldImport`, `Zaehlung`, `GpsImport`.
- Abnahme: Datenbank-Test mit zwei Revieren zeigt Datentrennung; die Karte lädt dieselben Objekte wie vorher.

### 1.8 Vektor-Basiskarte · O · braucht 1.4 und Entscheidung 1
- Stil von basemap.de als Basisstil; OSM-Raster als Rückfallebene; Luftbild bleibt als Ebene.
- Nach `setStyle` baut die Registry alle Fachebenen neu auf (`style.load`).
- Beschriftungen für Zonen, Schläge und Einrichtungen als `symbol`-Schichten; die HTML-Marker der Zonennamen
  (`zonenMarker`) entfallen.
- `public/sw.js`: Host der Kacheln in `HOSTS` aufnehmen. Quellenvermerk in der Karte ergänzen.
- Abnahme: Schlagnamen sind lesbar; Dunkelmodus geprüft; Kaltstart offline zeigt weiter die Karte.
- Vorher klären: Nutzungsbedingungen und Quellenvermerk von basemap.de.

### 1.9 Panels aus `Karte.tsx` lösen · S · braucht 1.5
Ebenen-Panel, „Heatmap & Abschüsse“, Wetter und das Menü „+ NEU“ werden eigene Komponenten unter
`src/karte/panels/`. Das Ebenen-Panel entsteht aus der Registry (Gruppen laut `EBENEN_GRUPPEN`).
- Abnahme: `Karte.tsx` hat unter 800 Zeilen; Rauchtest grün.

---

## Phase 2 – Bedienschicht

Abnahme der Phase: Feldtest – eine Sichtung ist nach dem Öffnen der App in höchstens drei Schritten gespeichert.

### 2.1 Fünf Bereiche · S · braucht 1.4
`Home.tsx` führt zwei Modullisten (Kacheln und Seitenleiste). Bereiche laut `ARCHITEKTUR.md` einführen; die
bestehenden Pfade bleiben gültig. Rechte je Menüpunkt unverändert (Inhaber, Masteradmin).
- Abnahme: Jeder bisherige Pfad ist erreichbar; Mitjäger sehen keine Inhaber-Punkte.

### 2.2 Rahmen für iPhone · O · braucht 2.1
Tab-Leiste unten (Karte, Erfassen, Jagd, Mehr), Sheet mit drei Rasten (Kopf, halb, voll) als gemeinsame
Komponente; bestehende Sheets (`EinrichtungSheet`, `FeldSheet`, `JagdzeitenSheet`, `WteSichtung`) ziehen um.
- Abnahme: Auf 390 px Breite bleibt die Karte hinter jedem Sheet sichtbar; Bedienziele mindestens 44 px.

### 2.3 Erfassen-Knopf · O · braucht 2.2
Ein Einstieg für Sichtung, Strecke, Wildschaden, Einrichtung; Formulare aus `Erfassung.tsx`, `Abschuesse.tsx`,
`Wildschaeden.tsx` teilen sich Positionswahl (GPS, Fadenkreuz) und Vorbelegung.
- Zone und Schlag lokal bestimmen (`punktInFlaeche`), Jagdzeit-Status aus `jagdzeitWarnung`.
- Speichern weiter über `speichernOderMerken`.
- Abnahme: Drei Schritte bis zum Speichern, offline wie online.

### 2.4 Kartenansichten · O · braucht 1.5 und 0.4 · Datenbank
Tabelle `karten_ansichten` (revier_id, user_id oder null für Reviervorgabe, name, inhalt jsonb, sortierung, Audit).
RLS: eigene Ansichten lesen und schreiben, Reviervorgaben lesen alle Mitglieder, schreiben Inhaber.
- Fünf Vorgaben als Code-Konstanten, eigene Ansichten in der Datenbank.
- Übernahme der Geräteeinstellungen (`hegewerk.karte.*`) beim ersten Start als Ansicht „Mein Gerät“.
- Abnahme: Eine am PC gespeicherte Ansicht erscheint auf dem iPhone.

### 2.5 Suche und Befehle · S · braucht 1.6
Ein Feld (Strg+K) über Einrichtungen, Zonen, Schläge, Routen und Befehle; Treffer springt auf die Karte.
Ortssuche und Flurstücke erst mit Phase 4.

### 2.6 Einheitliches Objekt-Detail · O · braucht 2.2
Gemeinsamer Rahmen für Zone, Einrichtung, Schlag, Sichtung, Strecke, Wildschaden, Aufgabe: Kopf, Kennzahlen,
Verlauf, Aktionen, Audit-Zeile. Bestehende Inhalte (`ZonenInfo`, `EinrichtungSheet`, `FeldSheet`) ziehen ein.

### 2.7 Deep Links auf Einzelobjekte · S · braucht 1.6 und 2.6
Glocke, Tabellen und Mails verlinken auf `o=<typ>:<id>` auch für Abschüsse, Wildschäden und Aufgaben.

---

## Phase 3 – Offline

Abnahme der Phase: Im Flugmodus lassen sich Zählung, Strecke und Bearbeitungen erfassen und nach dem
Wiederverbinden ohne Verlust und ohne Doppelung übertragen.

### 3.1 Outbox in IndexedDB mit Status · O · braucht 0.7
`src/lib/offline.ts` speichert in `localStorage` (`hegewerk.warteschlange`) und verwirft fachliche Fehler still.
- Outbox in der vorhandenen Datenbank `hegewerk-offline` (neuer Store, Versionssprung in `offlineCache.ts`).
- Status wartet, übertragen, abgelehnt; abgelehnte bleiben mit Fehlertext erhalten.
- Bestehende Einträge aus `localStorage` beim ersten Start übernehmen, danach den Schlüssel löschen.
- Reihenfolge und Abhängigkeiten (Zählung → Zeilen → Abschluss → Abschüsse) bleiben.
- Abnahme: Unit-Tests für Übernahme, Reihenfolge, Ablehnung; kein Eintrag verschwindet ohne Status.

### 3.2 Sync-Chip und Outbox-Ansicht · S · braucht 3.1
Chip in der Bereichsleiste und in der iPhone-Kopfzeile; Liste der wartenden und abgelehnten Einträge mit
„Erneut senden“, „Korrigieren“, „Verwerfen“. `OfflineHinweis.tsx` geht darin auf.

### 3.3 Lokaler Bestand · O · braucht 1.7 und 3.1
Feldtabellen (Grenze, Zonen, Einrichtungen, Routen, Schläge, Wildarten, Jagdzeiten, offene Zählung) werden per
`geaendert_seit` in IndexedDB gespiegelt; die Oberfläche liest lokal. Der Antwort-Cache (`cachingFetch`) bleibt
für Auswertungen.
- Abnahme: Kaltstart ohne Netz zeigt alle Feldobjekte; nach einer Änderung am PC kommt nur das Delta.

### 3.4 Bearbeiten und Löschen offline · O · braucht 3.3
Konfliktregeln laut `ARCHITEKTUR.md`; Soft-Delete über `geloescht_am`. Konflikte erscheinen in der Outbox-Ansicht.

### 3.5 Dauerhafter Speicher · S
`navigator.storage.persist()` nach der Installation anfragen, Ergebnis und Belegung unter Einstellungen →
Kartenspeicher anzeigen.

### 3.6 Revierpaket · O · braucht 1.8 und Entscheidung 3
Zuerst ein Spike: PMTiles aus dem Gerätespeicher auf iOS lesen (ungeprüft). Dann Paketbau (GitHub Actions,
GDAL), Ablage, „Revier offline laden“ mit Größe, Stand und Fortschritt. Die Reviergrenze darf nicht ins Repository.

### 3.7 Geräte-Abnahme Offline · braucht Benjamin
Abschnitt „Offline“ in `ABNAHME-GERAETE.md`.

---

## Phase 4 – Katalog und Editor

Abnahme der Phase: Das Revier wird ohne QGIS gepflegt.

- **4.1 Schema für Katalog · O · Datenbank** – `katalog_eintraege`, `flaechen_ebenen.art` erweitern, `quelle_stand`, `lizenz`.
- **4.2 Edge Function `katalog-abruf` · O** – WFS mit Paging und BBox der Reviergrenze, Umrechnung aus EPSG:25832, Zuschnitt serverseitig, Protokoll (übernommen, gekürzt, verworfen).
- **4.3 Katalog-Oberfläche · S** – Auswahl, Vorschau im Ausschnitt, Übernehmen, Aktualisieren mit Bestätigung, Quellenvermerk.
- **4.4 Schutzgebiete (NLWKN) · S** – nach `claude/schutzgebiete-katalog-refinement.md`; zuerst GetCapabilities prüfen.
- **4.5 Flurstücke (ALKIS) · O** – wegen der Menge als Vektorkacheln (`ST_AsMVT`); keine Eigentümerdaten.
- **4.6 Tatsächliche Nutzung und Flächenbilanz · S** – Bilanz je Revier und Zone als RPC.
- **4.7 Spike Terra Draw · O · Entscheidung 4** – Einrasten an fremden Ebenen und Touch auf dem iPad prüfen; Ergebnis in `ENTSCHEIDUNGEN.md`.
- **4.8 Editor · O** – Zeichnen, Stützpunkte, Einrasten, Rückgängig; löst Punktliste, `ZeichnenSheet` und das Menü „+ NEU“ ab. GPS-Aufzeichnung übernehmen.
- **4.9 Flächenwerkzeuge · O · Datenbank** – RPCs für Fläche aus Objekten, Teilen, Vereinigen, Ausstanzen, Puffer; immer innerhalb der Reviergrenze.
- **4.10 Messen · S** – Strecke, Fläche, Peilung; Höhenprofil erst mit 5.7.
- **4.11 Attributtabelle · S** – Sortieren, Filtern, Mehrfachbearbeitung; Vorbild `Einrichtungstabelle.tsx`.
- **4.12 Export · S** – je Ebene GeoJSON, GPX, KML, GeoPackage (sql.js ist vorhanden); „Revier komplett“.

## Phase 5 – Analyse, Zeit, Gelände

Abnahme der Phase: Kennzahlen je Zone und Schlag stimmen mit einer von Hand gezählten Stichprobe überein.

- **5.1 Automatische Zuordnung · O · Datenbank** – Spalten und Trigger für Zone, Schlag, Fruchtgruppe, Einrichtung; Nachtrag für Bestandsdaten als eigene Migration.
- **5.2 Raumauswertung · S** – RPC und Ansicht: Strecke, Sichtungen, Wildschäden je Zone, Schlag, Fruchtgruppe, Einrichtung, Stand.
- **5.3 Hexraster · S** – `ST_HexagonGrid`, als Ebene der Gruppe Analyse.
- **5.4 Zeitachse · O** – ein Zeitraum filtert alle Ebenen der Gruppe Geschehen; Anbaujahr folgt dem Jagdjahr.
- **5.5 Vergleich · S** – Schieber zwischen zwei Jagdjahren oder Luftbild und Karte.
- **5.6 Sitzwahl nach Wind · S** – geeignete Windrichtungen je Einrichtung, Abgleich mit der Prognose (Open-Meteo ist angebunden).
- **5.7 Gelände · O** – Schummerung, Höhenlinien, Hangneigung aus DGM1; Bewuchshöhe aus DOM1 minus DGM1.
- **5.8 Sichtfeld · O** – Berechnung im Browser aus Geländekacheln; Hinweis an der Funktion: Planungshilfe, ersetzt nicht die Prüfung vor Ort.
- **5.9 Ansitz als Vorgang · O · Datenbank** – Tabelle `ansitze`; Auswertungen je Ansitzstunde.

## Phase 6 – Jagdtag und Druck

Abnahme der Phase: Eine Bewegungsjagd läuft von der Planung bis zur Auswertung vollständig in Hegewerk.

- **6.1 Schusssektoren · O · Datenbank** – Sektor je Stand zeichnen, Überschneidungen mit Nachbarständen, Wegen und Gebäuden markieren; Hinweis wie bei 5.8.
- **6.2 Lagekarte · S** – Stände, Belegung, Strecke je Stand, Rettungspunkte für die Jagdleitung.
- **6.3 Druck-Engine · O** – `DruckKarte.tsx` (Luftbild in 300 dpi mit Overlay in Millimetern) verallgemeinern: Zonen, Schläge, Routen, Legende, Nordpfeil, UTM-Gitter, Quellenvermerk; A4 und A3 in 1:5.000, 1:10.000, 1:25.000.
- **6.4 Revierkarte zum Begehungsschein · S** – braucht 6.3.
- **6.5 Live-Funktionen · O · Entscheidung 7** – Ansitz-Belegung, Standort teilen mit Zustimmung und Ablaufzeit.
