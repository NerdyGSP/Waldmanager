# Waldmanager – Arbeitsanweisung für Claude

Waldmanager ist eine Plattform für Privatwaldbesitzer: Betriebsgrenze, Bestände, Maßnahmen und Fundmeldungen
(Käferbaum, Windwurf, Wildschaden) auf Karte und Luftbild. Vite + React 19 + TypeScript, MapLibre GL, Supabase
(Auth, Postgres mit RLS, PostGIS), Hosting auf Cloudflare Workers. Abgeleitet aus Hegewerk (Stand 11.11.2026).
Sprache der Oberfläche, der Bezeichner und der Kommentare ist Deutsch. Nutzer ist Benjamin (Masteradmin, Hobbyprojekt).

## Zuerst lesen

`docs/umbau/STATUS.md` – welches Umbaupaket erledigt ist und was als Nächstes kommt. Ein Paket pro Branch und
Pull Request. Am Ende `STATUS.md` aktualisieren.

## Befehle

```bash
npm ci
npm run dev        # http://localhost:5173, braucht .env (siehe .env.example)
npm run check      # Typprüfung + Unit-Tests – vor jedem Commit
npm run build      # Typprüfung + Produktions-Build – vor jedem Push
npm run test:watch # Tests beim Entwickeln
```

## Harte Regeln

- **Nie auf `main` pushen oder nach `main` mergen.** Sobald Cloudflare Workers Builds angebunden ist, geht ein Push auf
  `main` sofort live. Arbeite auf einem Branch `umbau/<nummer>-<kurzname>` bzw. `feature/<kurzname>` und öffne einen
  Pull Request; Benjamin mergt.
- **Schema-Änderungen nur mit Zustimmung von Benjamin in derselben Sitzung.** Sie entstehen als Datei in
  `supabase/migrations/<version>_<name>.sql` und werden erst danach angewendet. Lesende Abfragen sind in Ordnung.
- **Nie das Hegewerk-Supabase-Projekt (`gwxomufjifmurwodtybi`) verändern.** Waldmanager hat ein eigenes Projekt.
- **RLS-Muster für neue Tabellen:** Mitglieder des Betriebs lesen, Inhaber schreiben (Erfassungen wie Funde und
  Maßnahmen dürfen alle Mitglieder anlegen); Hilfsfunktionen im Schema `private` (`ist_mitglied`, `ist_inhaber`);
  Audit über den Trigger `private.audit_setzen()`.
- **Daten bleiben im Betrieb.** Koordinaten, Grenzen und Namen verlassen einen Forstbetrieb in keiner Funktion.
- **Nichts behaupten, was nicht geprüft ist.** Aus der Cloud-Sandbox sind `supabase.co` und LGLN oft nicht erreichbar,
  echte Geräte (iPhone, iPad) gar nicht. Schreibe in den PR, was geprüft wurde und was nicht.

## Konventionen

- Tests liegen neben der Quelle als `name.test.ts` (Vitest, Umgebung `node`, Zeitzone Europe/Berlin). Neue Fachlogik
  ohne Oberfläche bekommt Tests. Module, die `./supabase` importieren, im Test mit `vi.mock('./supabase', …)` entkoppeln.
- Fachlogik gehört in `src/lib/` (z. B. `forst.ts`, `massnahmen.ts`, `flurstuecke.ts`, `funde.ts`) oder `src/karte/`, nicht in Komponenten.
- Eigener Router (`src/lib/router.ts`): `navigieren(pfad)`, `usePfad()`. Keine Router-Bibliothek einführen.
- Geometrien: Schreiben per EWKT oder RPC aus GeoJSON, Lesen per RPC. Speicherung in WGS84.
- Erfassungen im Feld tragen clientseitige UUIDs und laufen über `src/lib/offline.ts` (`speichernOderMerken`).
  Fotos liegen bis zum Upload in IndexedDB (`src/lib/fotos.ts`), Pfad im Bucket `fund-fotos`: `<betrieb_id>/<fund_id>.jpg`.
- Baumarten werden mit forstlichem Kürzel gespeichert (`Fi`, `Bu`, `Ei` …, Liste in `src/lib/stammdaten.ts`),
  Anteile in ganzen Prozent mit Summe 100. Alter wird als Pflanzjahr gespeichert, damit es nicht veraltet.
- Design: Tokens in `src/styles/tokens.css`; Grün ist Primärfarbe; Radius 2/4/6/8 px, keine Schatten, keine Verläufe.
  Bedienziele auf dem iPhone mindestens 44 px.
- Neue Abhängigkeiten nur mit Zustimmung von Benjamin.
- TypeScript ist streng (`noUnusedLocals`, `noUnusedParameters`). Datenbanktypen in `src/lib/database.types.ts`
  werden nach Schema-Änderungen über das Supabase-MCP neu erzeugt.
- Commit-Nachrichten auf Deutsch: eine Zeile Zusammenfassung, darunter Stichpunkte.

## Orientierung im Code

| Pfad | Inhalt |
| --- | --- |
| `src/screens/Home.tsx` | Rahmen: Navigation, Seitenleiste, dauerhafte Karte ab 900 px |
| `src/screens/module/` | Fachmodule: `Karte.tsx`, `Bestaende.tsx`, `BestandInfo.tsx`, `Massnahmen.tsx`, `Flurstuecke.tsx`, `Funde.tsx` |
| `src/screens/Einstellungen.tsx` | Einstellungen und Betriebsverwaltung (Forstbetrieb, Mitglieder, Code einlösen) |
| `src/karte/` | Kartenkern: `ebenen/` (Registry), `kern/`, `modi/` |
| `src/lib/` | Fachlogik, Supabase-Client, Offline-Cache und Warteschlange, `geoimport.ts` (SHP/GeoPackage) |
| `public/sw.js` | Service Worker: App-Hülle und Kartenkacheln |
| `supabase/migrations/` | Schema-Historie des Waldmanager-Projekts |

Supabase-Projekt: „Waldmanager“, ID `giwqfhatjdhguqnreggg`, Region eu-central-1.

Git: In Cloud-Sitzungen immer im Klon `NerdyGSP/Waldmanager` arbeiten und vor jedem Push `git remote -v` prüfen.
Der Hegewerk-Klon der Sitzung wird automatisch auf Hegewerk zurückgesetzt.
