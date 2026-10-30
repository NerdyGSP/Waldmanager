import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import qrcode from 'qrcode-generator';
// QR-Code als SVG (schwarz auf weiß, mit Ruhezone), gut druckbar
export function QrCode({ text, groesse = 120, titel }) {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    const rand = 2;
    const zellen = [];
    for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++)
            if (qr.isDark(y, x))
                zellen.push(`M${x + rand} ${y + rand}h1v1h-1z`);
    return (_jsxs("svg", { width: groesse, height: groesse, viewBox: `0 0 ${n + rand * 2} ${n + rand * 2}`, role: "img", "aria-label": titel ?? 'QR-Code', shapeRendering: "crispEdges", children: [_jsx("rect", { width: "100%", height: "100%", fill: "#fff" }), _jsx("path", { d: zellen.join(''), fill: "#000" })] }));
}
