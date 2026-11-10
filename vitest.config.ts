import { defineConfig } from 'vitest/config';

// Unit-Tests für Fachlogik ohne Oberfläche. Tests liegen neben der Quelle: `name.test.ts`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Feste Zeitzone, damit Datumslogik (Jagdjahr, Jagdzeiten) überall gleich rechnet
    env: { TZ: 'Europe/Berlin' },
  },
});
