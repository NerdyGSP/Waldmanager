# Entscheidungen

Offene Entscheidungen trifft Benjamin. Bis dahin gilt die Spalte „Bis dahin“. Getroffene Entscheidungen wandern
mit Datum nach unten.

## Offen

| Nr. | Entscheidung | Optionen | Empfehlung | Gebraucht vor | Bis dahin |
| --- | --- | --- | --- | --- | --- |
| 1 | Basiskarte | basemap.de Web Vektor · selbst gehostete OSM-Vektorkarte · OSM-Raster behalten | basemap.de, sofern die Nutzungsbedingungen das Vorhalten im Offline-Paket erlauben | AP 1.8 | OSM-Raster und LGLN-Luftbild bleiben |
| 2 | Offline-Sync | A: lokaler Bestand und Outbox in IndexedDB · B: externer Sync-Dienst · C: Status quo ausbauen | A | AP 3.3 | AP 3.1 und 3.2 sind bei jeder Option richtig |
| 3 | Paketbau und Ablage | GitHub Actions mit Cloudflare R2 · Supabase Storage · manuell | Actions mit R2 | AP 3.6 | kein Revierpaket |
| 4 | Zeichenkern | Terra Draw · Eigenbau weiterführen | Terra Draw nach Spike (AP 4.7) | AP 4.8 | Zeichnen bleibt in `Karte.tsx` |
| 5 | Wasserschutzgebiete | aufnehmen · weglassen | offen | AP 4.4 | nicht im Katalog |
| 6 | Quelle für Schläge mit Fruchtart | Export aus Betriebssoftware · öffentlicher Datensatz | öffentliche Quelle für Niedersachsen prüfen | Phase 4 | Import aus Datei wie heute |
| 7 | Live-Funktionen | Ansitz-Belegung · Standort teilen · keine | erst nach Abstimmung im Hegering | AP 6.5 | keine |
| 8 | Staging | zweites Supabase-Projekt · Supabase-Branching | zweites Projekt | AP 0.4 | Datenbanktests mit `ROLLBACK`, keine Schema-Änderung ohne Freigabe |

## Ungeprüfte Annahmen

- Nutzungsbedingungen von basemap.de sind nicht gelesen, nur die Produktseite.
- Einrasten in Terra Draw ist nicht belegt (AP 4.7).
- Lesen von PMTiles aus dem Gerätespeicher auf iOS ist nicht geprüft (AP 3.6).
- Layer-Namen und Attribute des NLWKN-Dienstes sind nicht verifiziert (AP 4.4).
- Die Regel „Druckmodus nur für Inhaber in breiter Ansicht“ in `src/karte/modi/modi.ts` ist ein Vorschlag.

## Getroffen

| Datum | Entscheidung |
| --- | --- |
| 9.11.2026 | Umbau in Phasen statt Neubau; Supabase, RLS-Modell, Fachlogik und Design bleiben (Arbeitsgrundlage, von Benjamin mit dem Auftrag zum Fundament bestätigt) |
| 9.11.2026 | Gespeicherte Ebenen-Reihenfolge wird beim Hinzukommen einer Ebene ergänzt statt zurückgesetzt |
