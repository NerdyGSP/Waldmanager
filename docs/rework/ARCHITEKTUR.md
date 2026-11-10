# Zielbild

Hegewerk wird ein Revier-GIS mit Jagdfachlogik. Die Karte ist der Ort, an dem geplant, erfasst und ausgewertet
wird; alle anderen Ansichten sind Sichten auf dieselben Objekte.

## Leitprinzipien

- Eine Tätigkeit, ein Ort: Navigation folgt dem Ablauf (erfassen, planen, jagen, auswerten).
- Jedes Objekt hat Ort, Zeit und ein einheitliches Detail (Kennzahlen, Verlauf, Aktionen, Audit).
- Karte, Liste und Diagramm filtern gemeinsam.
- Jede Ansicht ist adressierbar: Ausschnitt, Ebenen, Auswahl und Zeitraum stehen in der URL.
- Offline ist der Normalfall: das Gerät arbeitet aus dem lokalen Bestand, das Netz gleicht ab.
- Fremddaten tragen Quelle, Stand und Lizenz; der Quellenvermerk entsteht automatisch, auch im Druck.
- Freigabegrenzen bleiben: keine Geometrien über Reviergrenzen hinweg.

## Fünf Bereiche statt 16 Menüpunkte

| Bereich | Bisherige Menüpunkte | Neu |
| --- | --- | --- |
| Revier | Karte, Zonen & Routen, Einrichtungstabelle, Feldgrenzen, Geodaten-Import, Kartendaten löschen | Katalog, Editor, Kartenansichten, Druck |
| Erfassen | Wildzählung, Einzelerfassung, Strecke, Wildschäden | Erfassen-Knopf, Ansitz |
| Jagd | Bewegungsjagd, Begehungsscheine, Aufgaben, Jagdzeiten | Lagekarte, Schusssektoren |
| Auswerten | Monitoring (Mein Revier, Jagdjahre, Quervergleich), Freigaben | Zeitachse, Raumauswertungen |
| Verwalten | Reviermanagement, CSV-Import, Einstellungen, Masteradmin | Offline-Pakete, Funktionsschalter |

Rahmen: PC und iPad quer mit schmaler Bereichsleiste links, Karte im Rest, Panel nach der Regel „1/3 | Voll“.
iPhone und iPad hochkant mit Karte im Vollbild, Tab-Leiste unten und Sheet mit drei Rasten.
Die Karte läuft als eine dauerhafte Instanz hinter allen Bereichen.

## Kartenmodi

Genau ein Modus ist aktiv. Definiert in `src/karte/ebenen/typen.ts` und `src/karte/modi/modi.ts`.

| Modus | Sichtbare Ebenen | Klick oder Tap | Werkzeuge |
| --- | --- | --- | --- |
| ansehen | Gewählte Kartenansicht | Objekt wählen, Detail öffnen | Suche, Ebenen, Messen |
| erfassen | Ansicht „Feld“ | Position setzen | Fadenkreuz, GPS |
| zaehlen | Grenze, Basiskarte, WTE-Zonen, WTE-Routen | Zone öffnet den Sichtungsdialog | Zähler, Abschluss |
| bearbeiten | Zielebene und Einrast-Ebenen | Stützpunkte setzen und ziehen | Zeichnen, Teilen, Vereinigen, Rückgängig |
| jagdtag | Stände, Sektoren, Routen, Rettungspunkte | Stand zeigt Teilnehmer und Strecke | Lage, Streckenerfassung |
| druck | Gewählte Kartenansicht | Druckrahmen verschieben | Format, Maßstab, Legende |

Heute bilden `modus`, `wte` und `sheetArt` in `Karte.tsx` diese Zustände gemeinsam ab.

## Kartenkern

```
src/karte/
  ebenen/     Deklaration je Ebene, Registry, Einstellungen
  kern/       eine Karteninstanz für die App, Quellen, Ereignisse, URL-Zustand, Geometrie
  modi/       Zustandsmaschine der Kartenmodi
  werkzeuge/  Editor, Messen, Analyse, Druck
```

Datenfluss in fünf Schichten: Quellen (basemap.de, LGLN, NLWKN, Dateien, Erfassung) → Aufnahme (Katalog und
Import mit Zuschnitt auf die Reviergrenze, Paketbau) → Bestand (PostGIS, Objektspeicher mit PMTiles, Gerät mit
lokalem Bestand und Outbox) → Kartenkern (Registry, Modi, Werkzeuge, Zeitachse) → Ausgabe (Bildschirm, Druck und
Export, Offline-Paket).

Eine Ebene ist eine Deklaration (`EbenenDeklaration`): Schlüssel, Titel, Gruppe, MapLibre-Schichten,
Standardwerte, erlaubte Modi. Im Ausbau kommen Quelle, Darstellung, Legende, Beschriftung, Rechte,
Offline-Verhalten und Detail-Typ dazu. React rendert nur Panels, Sheets und Legende; die Karte selbst lebt
außerhalb von React.

Ebenen-Gruppen: Basiskarte, Recht & Schutz, Landwirtschaft, Revierstruktur, Geschehen, Analyse, Skizzen.

## Kartenansichten

Eine Kartenansicht speichert Ebenen, Reihenfolge, Deckkraft, Filter und Ausschnitt in der Datenbank und ist auf
allen Geräten gleich. Sie ersetzt die Geräteeinstellungen in `localStorage` (`hegewerk.karte.*`, rund 17 Schlüssel).
Vorgaben: Feld, Zählung, Bewegungsjagd, Landwirtschaft, Schutz & Recht.

URL-Format (`src/karte/kern/urlZustand.ts`):
`?k=<lng>,<lat>,<zoom>&m=<modus>&a=<ansicht>&o=<typ>:<id>&z=<von>..<bis>`

## Daten

Geplante Schema-Ergänzungen (jeweils eigenes AP mit Migration):

| Objekt | Zweck |
| --- | --- |
| `katalog_eintraege` (global) | Quelle, Dienstadresse, Lizenztext, Attributzuordnung je Katalogebene |
| `flaechen_ebenen`: `art` erweitert, `quelle_stand`, `lizenz` | Fremdebenen im bestehenden Modell (Schutzgebiet, Flurstück, Nutzung, Eigene) |
| `karten_ansichten` | Ansichten je Nutzer oder Revier |
| Zuordnungsspalten an `beobachtungen`, `abschuesse`, `wildschaeden` | Zone, Schlag, Fruchtgruppe, Einrichtung per Trigger |
| `sektoren` an Bewegungsjagd-Ständen | Richtung von und bis, Reichweite |
| `ansitze` | Beginn, Ende, Einrichtung, Wind; Bezugsgröße für den Aufwand |
| `reviere.funktionen` (jsonb) | Funktionsschalter je Revier für den Pilotbetrieb |
| Objektspeicher `revierpakete` | PMTiles je Revier, Zugriff nur für Mitglieder |

Datenzugriff: `karte_daten` wird je Ebene aufgeteilt; jede Funktion nimmt `geaendert_seit` und liefert nur
Änderungen (`aktualisiert_am`, `geloescht_am` sind vorhanden). Große Fremdebenen kommen als Vektorkacheln aus
PostGIS (`ST_AsMVT`), kleine als GeoJSON. Katalogabrufe laufen über eine Edge Function, nie aus dem Browser.

## Offline

Empfohlen ist Option A: lokaler Bestand und Outbox in IndexedDB, kein zusätzlicher Dienst.

- Jeder Outbox-Eintrag hat einen Status: wartet, übertragen, abgelehnt. Abgelehnte bleiben sichtbar, mit Grund
  und den Aktionen Korrigieren oder Verwerfen. Heute verwirft `src/lib/offline.ts` fachliche Fehler still.
- Bearbeiten und Löschen funktionieren offline. Bei Erfassungen gewinnt die letzte Änderung, bei Geometrien und
  Verwaltung der Server; der Konflikt wird angezeigt.
- Ein Sync-Chip zeigt wartende Einträge und den Stand des lokalen Bestands.
- Revierpaket: Basiskarte, Luftbild und Gelände als PMTiles, Fachdaten als lokaler Bestand; die App fordert
  dauerhaften Speicher an (`navigator.storage.persist()`).

## Quellen für Kartendaten

| Daten | Quelle | Hinweis |
| --- | --- | --- |
| Vektor-Basiskarte | basemap.de Web Vektor, Stile Farbe, Grau, Relief | Nutzungsbedingungen für das Offline-Vorhalten ungeprüft |
| Luftbild DOP20 | LGLN, WMS | im Einsatz |
| Flurstücke, tatsächliche Nutzung (ALKIS) | LGLN, WFS und GeoPackage, CC BY 4.0 | ohne Eigentümerdaten führen |
| Gelände DGM1, Oberfläche DOM1 | LGLN, OpenGeoData.NI | Paketbau außerhalb des Browsers |
| Schutzgebiete | NLWKN, INSPIRE-WFS | Layer-Namen nicht verifiziert, siehe `claude/schutzgebiete-katalog-refinement.md` |
| Schläge mit Fruchtart | offen | heute Import aus Betriebssoftware |
