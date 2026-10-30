import { csvLesen, textAusDatei } from './csv';
export const JAGDARTEN = ['Drückjagd', 'Treibjagd', 'Ansitzdrückjagd', 'Sonstige'];
// Code wird als 8 Zeichen gespeichert und als XXXX-XXXX angezeigt
export function codeAnzeigen(code) {
    const c = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4, 8)}` : c;
}
export function emailGueltig(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}
let zaehler = 0;
export function neuerEntwurf(name, email, telefon = '') {
    return { key: `t${Date.now()}-${zaehler++}`, name: name.trim(), email: email.trim(), telefon: telefon.trim(), aktiv: true };
}
// CSV „Name;E-Mail[;Telefon]“ (Trennzeichen automatisch, Kopfzeile wird erkannt)
export function teilnehmerCsv(puffer) {
    const zeilen = csvLesen(textAusDatei(puffer));
    const erste = zeilen[0]?.map((f) => f.toLowerCase()) ?? [];
    const mitKopf = erste.some((f) => f.includes('mail')) || (erste[0] === 'name' && !erste.some((f) => f.includes('@')));
    return (mitKopf ? zeilen.slice(1) : zeilen)
        .filter((z) => z[0] || z[1])
        .map((z) => {
        // Reihenfolge tolerant: steht die Adresse vorn, wird getauscht
        const [a = '', b = '', c = ''] = z;
        return a.includes('@') && !b.includes('@') ? neuerEntwurf(b, a, c) : neuerEntwurf(a, b, c);
    });
}
export function navigationsLinks(lat, lng) {
    return {
        apple: `https://maps.apple.com/?daddr=${lat},${lng}`,
        google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    };
}
