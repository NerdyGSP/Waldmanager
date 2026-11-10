# Status

Stand: 9.11.2026 · Branch `rework/fundament` (noch nicht in `main`)

## Nächster Schritt

1. Benjamin: Pull Request von `rework/fundament` prüfen und mergen; Entscheidung 8 (Staging) treffen.
2. Danach AP 0.5 (Rauchtest mit Supabase-Mock). Es sichert alle weiteren Umbauten an der Karte ab.
3. Dann AP 1.2.

## Phase 0 – Fundament

- [x] 0.1 Vitest und Tests der Fachlogik (9.11.2026)
- [x] 0.2 CI (9.11.2026)
- [ ] 0.3 Migrationen im Repository – Dateien liegen vor, Durchlauf auf leerer Datenbank ungeprüft
- [ ] 0.4 Staging – braucht Benjamin
- [ ] 0.5 End-to-End-Rauchtest mit Supabase-Mock
- [ ] 0.6 Ausgangsmessung auf Geräten – braucht Benjamin
- [ ] 0.7 Weitere Unit-Tests
- [ ] 0.8 Schutz von `main` – braucht Benjamin

## Phase 1 – Kartenkern

- [x] 1.1 Registry, Einstellungen, Geometrie (9.11.2026)
- [ ] 1.2 Schichten je Ebene auslagern
- [ ] 1.3 Sichtbarkeit und Deckkraft deklarativ
- [ ] 1.4 Eine Karteninstanz außerhalb von React
- [ ] 1.5 Kartenmodi anschließen – `modi.ts` vorhanden, nicht angeschlossen
- [ ] 1.6 Kartenzustand in der URL – `urlZustand.ts` vorhanden, nicht angeschlossen
- [ ] 1.7 `karte_daten` aufteilen
- [ ] 1.8 Vektor-Basiskarte
- [ ] 1.9 Panels aus `Karte.tsx` lösen

## Phasen 2 bis 6

Nicht begonnen. Pakete siehe `ARBEITSPAKETE.md`.

## Was am 9.11.2026 geprüft wurde und was nicht

Geprüft: Typprüfung, 45 Unit-Tests, Produktions-Build.

Nicht geprüft:
- Die Karte im Browser nach dem Umbau von `Karte.tsx`. Die Änderung verschiebt Konstanten und Hilfsfunktionen
  und ist typgeprüft, lief aber gegen kein Supabase. Vor dem Merge einmal Nr. 1 bis 4 aus `ABNAHME-GERAETE.md`.
- Ob die 53 Migrationen auf einer leeren Datenbank durchlaufen (AP 0.3).

## Verhaltensänderungen gegenüber `main`

- **CSV-Import, Fehlerbehebung:** `datumLesen` las vierstellige Jahre in deutschen Datumsangaben nur zweistellig
  (aus `03.05.2024` wurde `2020-05-03`, aus `01.01.1998` wurde `2019-01-01`). Behoben in `src/lib/csv.ts`.
  Bereits importierte historische Zählungen und Abschüsse mit Datum im Format `TT.MM.JJJJ` können ein falsches
  Jahr tragen. Daten im ISO-Format und mit zweistelligem Jahr waren nicht betroffen.
- **Ebenen-Reihenfolge:** Ein gespeicherter Stand mit fehlenden oder unbekannten Ebenen wird ergänzt statt auf
  den Standard zurückgesetzt.

## Notizen für die nächste Sitzung

- `Karte.tsx` hat noch 1.991 Zeilen. Der `load`-Handler (suche `m.on('load'`) ist der Einstieg für AP 1.2.
- Die Titel in der Registry werden noch nicht angezeigt; das Panel nutzt `ebenenInfo` in `Karte.tsx` (AP 1.9).
- `public/_headers` setzt keine Content-Security-Policy; neue Kachel-Hosts brauchen dort keine Freigabe, wohl
  aber einen Eintrag in `HOSTS` in `public/sw.js`, damit sie zwischengespeichert werden.
- Der Build warnt vor einem Hauptpaket über 1,5 MB; nicht Teil des Reworks, aber ein Kandidat für Code-Splitting.
