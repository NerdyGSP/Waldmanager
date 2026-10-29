// Übersetzt Fehlermeldungen von Supabase in verständliches Deutsch.
const bekannte: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'E-Mail oder Passwort ist falsch.'],
  [/email not confirmed/i, 'Bitte bestätige zuerst deine E-Mail-Adresse über den Link in der Bestätigungsmail.'],
  [/user already registered/i, 'Für diese E-Mail-Adresse gibt es bereits einen Account. Melde dich an und löse den Code dort ein.'],
  [/password should be at least/i, 'Das Passwort muss mindestens 8 Zeichen lang sein.'],
  [/weak password|password is too weak/i, 'Das Passwort ist zu schwach. Bitte wähle ein längeres Passwort.'],
  [/rate limit|too many requests/i, 'Zu viele Versuche. Bitte warte kurz und versuche es erneut.'],
  [/database error saving new user/i, 'Registrierung fehlgeschlagen. Bitte prüfe den Einladungscode und die E-Mail-Adresse.'],
  [/delete on table "hegeringe" violates foreign key/i, 'Dem Hegering sind noch Reviere zugeordnet. Bitte diese zuerst löschen.'],
  [/insert or update on table "reviere" violates foreign key/i, 'Der gewählte Hegering existiert nicht mehr. Bitte die Seite neu laden und erneut auswählen.'],
  [/zonen_name_eindeutig/i, 'Eine Zone mit diesem Namen gibt es in diesem Revier bereits. Bitte einen anderen Namen wählen.'],
  [/einrichtungen_name_eindeutig/i, 'Eine Einrichtung mit diesem Namen gibt es in diesem Revier bereits. Bitte einen anderen Namen wählen.'],
  [/zonen_ebenen_name_eindeutig/i, 'Eine Zonenebene mit diesem Namen gibt es in diesem Revier bereits.'],
  [/duplicate key value/i, 'Ein Eintrag mit diesem Namen existiert bereits.'],
  [/failed to fetch|network/i, 'Keine Verbindung zum Server. Bitte prüfe die Internetverbindung.'],
];

export function fehlertext(fehler: unknown): string {
  const nachricht =
    fehler instanceof Error
      ? fehler.message
      : typeof fehler === 'object' && fehler && 'message' in fehler
        ? String((fehler as { message: unknown }).message)
        : String(fehler);

  for (const [muster, text] of bekannte) {
    if (muster.test(nachricht)) return text;
  }
  // Eigene Meldungen aus der Datenbank sind bereits deutsch
  return nachricht;
}

export function codeFormatieren(eingabe: string): string {
  const roh = eingabe.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return roh.length > 4 ? `${roh.slice(0, 4)}-${roh.slice(4)}` : roh;
}
