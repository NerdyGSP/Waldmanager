import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Gemeinsamer Druckbereich: ein Container #druck-root direkt unter <body>.
// Solange ein DruckPortal gemountet ist, trägt <body> die Klasse "druckt";
// im Druck (siehe styles.css) ist dann nur #druck-root sichtbar.
export function DruckPortal({ children }: { children: ReactNode }) {
  const [ziel, setZiel] = useState<HTMLElement | null>(null);
  useEffect(() => {
    let el = document.getElementById('druck-root');
    if (!el) {
      el = document.createElement('div');
      el.id = 'druck-root';
      document.body.appendChild(el);
    }
    document.body.classList.add('druckt');
    setZiel(el);
    return () => {
      document.body.classList.remove('druckt');
    };
  }, []);
  return ziel ? createPortal(children, ziel) : null;
}
