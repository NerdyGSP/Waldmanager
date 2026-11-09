# Hegewerk – Arbeitsanweisung für Claude

Hegewerk ist eine Plattform für Wildtiererfassung und Reviermanagement im Hegering: Vite + React 19 + TypeScript,
MapLibre GL, Supabase (Auth, Postgres mit RLS, PostGIS), Hosting auf Cloudflare Workers. Sprache der Oberfläche,
der Bezeichner und der Kommentare ist Deutsch. Nutzer ist Benjamin (Masteradmin und Inhaber des Reviers „Hachmühlen I“).

## Zuerst lesen

Das Projekt wird schrittweise umgebaut (Rework). Vor jeder Arbeit daran:

1. `docs/rework/STATUS.md` – was erledigt ist und was als Nächstes kommt
2. `docs/rework/ARBEITSPAKETE.md` – das Arbeitspaket (AP), an dem du arbeitest
3. `docs/rework/ARCHITEKTUR.md` – Zielbild, wenn das AP Struktur berührt
4. `docs/rework/ENTSCHEIDUNGEN.md` – offene Entscheidungen und was bis dahin gilt
5. `docs/rework/klickdummy/LIESMICH.md` – verbindliches Zielbild der Oberfläche, sobald ein AP Sichtbares ändert

Ein AP pro Sitzung und pro Pull Request. Am Ende `STATUS.md` aktualisieren.

## Befehle

```bash
npm ci
npm run dev        # http://localhost:5173, braucht .env (siehe .env.example)
npm run check      # Typprüfung + Unit-Tests – vor jedem Commit
npm run build      # Typprüfung + Produktions-Build – vor jedem Push
npm run test:watch # Tests beim Entwickeln
```

## Harte Regeln

- **Nie auf `main` pushen oder nach `main` mergen.** Ein Push auf `main` geht sofort in Produktion (Cloudflare Workers
  Builds). Arbeite auf einem Branch `rework/<ap-nummer>-<kurzname>` und öffne einen Pull Request; Benjamin mergt.
- **Keine Änderung an der Produktionsdatenbank ohne ausdrückliche Zustimmung von Benjamin in derselben Sitzung.**
  Es gibt noch kein Staging (AP 0.4). Lesende Abfragen sind in Ordnung. Schema-Änderungen entstehen als Datei in
  `supabase/migrations/<version>_<name>.sql`; angewendet werden sie erst nach Freigabe. Bis Staging steht, werden
  Datenbankfunktionen in einer Transaktion mit `ROLLBACK` getestet.
- **Keine neuen Ebenen und keine neuen Funktionen in `src/screens/module/Karte.tsx`.** Die Datei wird abgebaut.
  Neues entsteht unter `src/karte/` und wird von dort eingebunden.
- **Freigabegrenzen bleiben.** Reviere teilen nur Zähl- und Abschusszahlen je Wildart. Koordinaten, Grenzen,
  Einrichtungen und Namen verlassen ein Revier in keiner Funktion.
- **RLS-Muster für neue Tabellen:** Mitglieder des Reviers lesen, Inhaber schreiben; Hilfsfunktionen im Schema
  `private` (`ist_mitglied`, `ist_inhaber`); Audit über den Trigger `private.audit_setzen()`.
- **Verhalten nur ändern, wenn das AP es verlangt.** Umbauten sind verhaltensgleich; Abweichungen stehen im PR-Text.
- **Nichts behaupten, was nicht geprüft ist.** Aus der Cloud-Sandbox sind `supabase.co`, LGLN und Brevo oft nicht
  erreichbar; echte Geräte (iPhone, iPad) gar nicht. Schreibe in den PR, was geprüft wurde und was nicht.

## Konventionen

- Tests liegen neben der Quelle als `name.test.ts` (Vitest, Umgebung `node`, Zeitzone Europe/Berlin). Neue Fachlogik
  ohne Oberfläche bekommt Tests. Module, die `./supabase` importieren, im Test mit `vi.mock('./supabase', …)` entkoppeln.
- Fachlogik gehört in `src/lib/` oder `src/karte/`, nicht in Komponenten. Komponenten rendern und rufen auf.
- Eigener Router (`src/lib/router.ts`): `navigieren(pfad)`, `usePfad()`. Keine Router-Bibliothek einführen.
- Geometrien: Schreiben per EWKT (`punktEWKT`, `linieEWKT`) oder RPC aus GeoJSON, Lesen per RPC. Speicherung in WGS84.
- Erfassungen tragen clientseitige UUIDs und laufen über `src/lib/offline.ts` (`speichernOderMerken`), damit sie
  offline funktionieren.
- Design: Tokens in `src/styles/tokens.css`; Grün ist Primärfarbe, Orange höchstens eine Akzent-Aktion je Ansicht;
  Radius 2/4/6/8 px, keine Schatten, keine Verläufe. Bedienziele auf dem iPhone mindestens 44 px.
- Neue Abhängigkeiten nur, wenn das AP sie nennt oder Benjamin zustimmt.
- TypeScript ist streng (`noUnusedLocals`, `noUnusedParameters`). Datenbanktypen in `src/lib/database.types.ts`
  werden nach Schema-Änderungen über das Supabase-MCP neu erzeugt, nicht von Hand bearbeitet.
- Commit-Nachrichten auf Deutsch: eine Zeile Zusammenfassung, darunter Stichpunkte.

## Orientierung im Code

| Pfad | Inhalt |
| --- | --- |
| `src/screens/Home.tsx` | Rahmen: Navigation, Seitenleiste, dauerhafte Karte ab 900 px |
| `src/screens/module/` | Fachmodule (Karte, Zählung, Strecke, Zonen, Import …) |
| `src/screens/bewegungsjagd/` | Bewegungsjagd inklusive Druck (`BjDruck.tsx`, `DruckKarte.tsx`) |
| `src/karte/` | Neuer Kartenkern: `ebenen/` (Registry), `kern/`, `modi/`, `werkzeuge/` |
| `src/lib/` | Fachlogik, Supabase-Client, Offline-Cache und Warteschlange |
| `public/sw.js` | Service Worker: App-Hülle und Kartenkacheln |
| `supabase/migrations/` | Schema-Historie (Stand 9.11.2026 aus der Produktion übernommen) |
| `supabase/functions/` | Edge Functions für den Mailversand (Brevo) |

Supabase-Projekt: „Hegewerk“, ID `gwxomufjifmurwodtybi`, Region eu-west-1. Domain: hegewerk.app.
Fachlicher Hintergrund steht in den Projektdokumenten bei Claude (`claude/revier-webapp-kontext.md` und weitere).
