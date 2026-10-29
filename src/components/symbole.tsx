// Linien-Symbole für die Navigation (24×24, Farbe über currentColor)
const PFADE: Record<string, string> = {
  karte: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14',
  zaehlung: 'M4 6h3M5.5 4.5v3M4 17h3M13 6h7M13 12h7M13 18h7M4 12l3 0',
  erfassung: 'M2 12c1.8-4 5.6-7 10-7s8.2 3 10 7c-1.8 4-5.6 7-10 7s-8.2-3-10-7Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  abschuesse: 'M12 3v4m0 10v4M3 12h4m10 0h4 M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z',
  monitoring: 'M5 20V11m5 9V5m5 15v-6m5 6V9M3 20h18',
  zonen: 'M5 7 12 3l7 5-2 10H7L5 7Z',
  freigaben: 'M8 12l3 3 5-6 M12 3l8 4v5c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V7l8-4Z',
  einstellungen:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
};

export function Symbol({ name, className = 'symbol' }: { name: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d={PFADE[name] ?? ''} />
    </svg>
  );
}
