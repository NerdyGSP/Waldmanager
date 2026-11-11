# Waldmanager

Waldmanagement für Privatwaldbesitzer: Betriebsgrenze, Bestände, Maßnahmen und Fundmeldungen (Käferbaum, Windwurf, Wildschaden) auf Karte und Luftbild. Hobbyprojekt, abgeleitet aus Hegewerk (Stand 11.11.2026). Frontend als Vite/React-App auf Cloudflare Workers (Static Assets), Backend in Supabase (Auth, Postgres mit Row Level Security, PostGIS).

## Lokal starten

```bash
cp .env.example .env   # Publishable Key aus Supabase eintragen
npm install
npm run dev            # http://localhost:5173
```

## Prüfen

```bash
npm run check          # Typprüfung und Unit-Tests
npm run build          # Typprüfung und Produktions-Build
```

Die CI (GitHub Actions) führt beides für jeden Branch und Pull Request aus.

## Umbau

Der Umbau aus Hegewerk läuft in drei Paketen. Stand: [docs/umbau/STATUS.md](docs/umbau/STATUS.md). Arbeitsregeln für Claude stehen in [CLAUDE.md](CLAUDE.md).

## Deployment

Über Cloudflare Workers Builds bei jedem Push auf `main`. Deshalb wird nur über Pull Requests nach `main` gemergt.

| Einstellung | Wert |
| --- | --- |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Build-Variablen | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` |

Der Worker-Name im Cloudflare-Dashboard muss `waldmanager` lauten (siehe `wrangler.jsonc`).

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `src/auth/` | Session-Verwaltung |
| `src/screens/` | Anmeldung, Registrierung mit Einladungscode, Startseite, Forstbetrieb, Masteradmin |
| `src/screens/module/` | Fachmodule: Karte, Bestände |
| `src/karte/` | Kartenkern: Ebenen-Registry, Modi, Geometrie |
| `src/lib/` | Fachlogik (`forst.ts`), Supabase-Client, Offline-Cache und Warteschlange |
| `src/lib/database.types.ts` | Aus Supabase generierte Typen |
| `supabase/migrations/` | Schema-Historie |
| `public/_headers` | Sicherheits-Header für Cloudflare |
| `wrangler.jsonc` | Cloudflare-Konfiguration inkl. SPA-Routing |

## Rollen

- **Masteradmin:** legt Forstbetriebe an, lädt Inhaber ein, löscht Betriebe – kein Zugriff auf Fachdaten fremder Betriebe.
- **Inhaber:** verwaltet seinen Forstbetrieb, Grenze, Bestände und Mitglieder.
- **Mitarbeiter:** sieht den Betrieb, legt Maßnahmen an und meldet Funde.

Registrierung nur mit Einladungscode (`XXXX-XXXX`, einmalig, mit Ablaufdatum). Es gibt keinen Mailversand; Codes werden persönlich weitergegeben.
