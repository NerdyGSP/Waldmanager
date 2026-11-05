// Gemeinsame Mail-Bausteine der Edge Functions (Absender, Antwortadresse, Escaping)
export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
export const BASIS = 'https://hegewerk.app';
export const ABSENDER_ADRESSE = 'noreply@hegewerk.app';

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const SUFFIX = ' · Hegewerk';

/** Anzeigename „Revier <Name> · Hegewerk“: Steuerzeichen und Anführungszeichen entfernt, höchstens 60 Zeichen */
export function absender(revierName: string | null | undefined): { name: string; email: string } {
  // deno-lint-ignore no-control-regex
  const roh = String(revierName ?? '').replace(/[\u0000-\u001f\u007f"'„“”‚‘’`<>]/g, '').replace(/\s+/g, ' ').trim();
  const kopf = roh ? `Revier ${roh}` : 'Hegewerk';
  if (!roh) return { name: 'Hegewerk', email: ABSENDER_ADRESSE };
  const platz = 60 - SUFFIX.length;
  const gekuerzt = kopf.length > platz ? kopf.slice(0, platz).trimEnd() : kopf;
  return { name: gekuerzt + SUFFIX, email: ABSENDER_ADRESSE };
}

export const gueltigeMail = (s: unknown): s is string => typeof s === 'string' && /^[^@\s<>",;]+@[^@\s<>",;]+\.[^@\s<>",;]+$/.test(s.trim()) && s.length <= 254;

/** replyTo: gespeicherte Antwortadresse, sonst E-Mail des Inhabers; ohne beides kein replyTo */
export function replyTo(antwortAn: unknown, inhaberMail: unknown): { email: string } | undefined {
  if (gueltigeMail(antwortAn)) return { email: antwortAn.trim() };
  if (gueltigeMail(inhaberMail)) return { email: inhaberMail.trim() };
  return undefined;
}

export const codeAnzeige = (c: string) => `${c.slice(0, 4)}-${c.slice(4)}`;
