import { jsx as _jsx } from "react/jsx-runtime";
import { MD3 } from '../lib/md3';
// Material Symbols (Material Design 3, Outlined); Farbe über currentColor / CSS
export function Symbol({ name, className = 'symbol' }) {
    return (_jsx("svg", { className: className, viewBox: "0 -960 960 960", "aria-hidden": "true", children: _jsx("path", { d: MD3[name] ?? '' }) }));
}
