import { MD3 } from '../lib/md3';

// Material Symbols (Material Design 3, Outlined); Farbe über currentColor / CSS
export function Symbol({ name, className = 'symbol' }: { name: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 -960 960 960" aria-hidden="true">
      <path d={MD3[name] ?? ''} />
    </svg>
  );
}
