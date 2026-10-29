// Linien-Symbole für die Navigation (24×24, Farbe über currentColor)
const PFADE: Record<string, string> = {
  karte: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14',
  zaehlung: 'M4 6h3M5.5 4.5v3M4 17h3M13 6h7M13 12h7M13 18h7M4 12l3 0',
  erfassung: 'M2 12c1.8-4 5.6-7 10-7s8.2 3 10 7c-1.8 4-5.6 7-10 7s-8.2-3-10-7Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  abschuesse: 'M12 3v4m0 10v4M3 12h4m10 0h4 M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z',
  monitoring: 'M5 20V11m5 9V5m5 15v-6m5 6V9M3 20h18',
  zonen: 'M5 7 12 3l7 5-2 10H7L5 7Z',
  freigaben: 'M8 12l3 3 5-6 M12 3l8 4v5c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V7l8-4Z',
  wildschaeden: 'M12 3c3 4 6 6.5 6 10a6 6 0 0 1-12 0c0-3.5 3-6 6-10Zm0 9v5m-2-2.5h4',
  aufgaben: 'M4 6.5l1.8 1.8L9 5M4 12.5l1.8 1.8L9 11M4 18.5l1.8 1.8L9 17M12 7h8M12 13h8M12 19h8',
  begehungsscheine: 'M6 3h9l4 4v14H6V3Zm9 0v4h4M9 12h7M9 16h7M9 8h3',
  import: 'M12 4v11m0 0-4-4m4 4 4-4M5 20h14',
  einklappen: 'M15 6l-6 6 6 6',
  ausklappen: 'M9 6l6 6-6 6',
  abdocken: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
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
