# Hegewerk

Plattform für Wildtiererfassung und Reviermanagement im Hegering. Frontend als Vite/React-App auf Cloudflare Workers (Static Assets), Backend in Supabase (Auth, Postgres mit Row Level Security, PostGIS).

## Lokal starten

```bash
cp .env.example .env   # Publishable Key aus Supabase eintragen
npm install
npm run dev            # http://localhost:5173
```

## Deployment

Automatisch über Cloudflare Workers Builds bei jedem Push auf `main`.

| Einstellung | Wert |
| --- | --- |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Build-Variablen | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` |

Der Worker-Name im Cloudflare-Dashboard muss `hegewerk` lauten (siehe `wrangler.jsonc`).

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `src/auth/` | Session-Verwaltung |
| `src/screens/` | Anmeldung, Registrierung mit Einladungscode, Startseite, Mitglieder, Masteradmin |
| `src/lib/database.types.ts` | Aus Supabase generierte Typen |
| `public/_headers` | Sicherheits-Header für Cloudflare |
| `wrangler.jsonc` | Cloudflare-Konfiguration inkl. SPA-Routing |

## Rollen

- **Masteradmin:** legt Hegeringe und Reviere an, lädt Inhaber ein, löscht Reviere – kein Zugriff auf Fachdaten.
- **Revierinhaber/-pächter:** verwaltet sein Revier und dessen Mitglieder.
- **Mitjäger:** erfasst Zählungen, Beobachtungen und Abschüsse.

Registrierung nur mit Einladungscode (`XXXX-XXXX`, einmalig, mit Ablaufdatum). Danach Login mit E-Mail und Passwort auf allen Geräten.
