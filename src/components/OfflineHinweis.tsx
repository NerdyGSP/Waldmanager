import { useEffect, useState } from 'react';
import { AUS_CACHE_EREIGNIS, offlineCacheAufraeumen, zuletztAusCacheAm } from '../lib/offlineCache';

const iOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const istInstalliert = () => (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches;

// Schmale Leiste: Offline-Status und (nur iPhone/iPad im Browser) Hinweis zum Installieren auf den Home-Bildschirm
export function OfflineHinweis() {
  const [online, setOnline] = useState(navigator.onLine);
  const [ausCache, setAusCache] = useState(false);
  const [tipp, setTipp] = useState(() => {
    try {
      return iOS() && !istInstalliert() && localStorage.getItem('waldmanager.tipp.installieren') !== '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const an = () => setOnline(true);
    const aus = () => setOnline(false);
    const cache = () => setAusCache(Date.now() - zuletztAusCacheAm() < 20000);
    window.addEventListener('online', an);
    window.addEventListener('offline', aus);
    window.addEventListener(AUS_CACHE_EREIGNIS, cache);
    const t = window.setInterval(cache, 5000);
    // Speicher als „dauerhaft“ anfordern (verhindert, dass das System ihn bei Platzmangel löscht) und Altes aufräumen
    void navigator.storage?.persist?.().catch(() => undefined);
    void offlineCacheAufraeumen();
    return () => {
      window.removeEventListener('online', an);
      window.removeEventListener('offline', aus);
      window.removeEventListener(AUS_CACHE_EREIGNIS, cache);
      window.clearInterval(t);
    };
  }, []);

  return (
    <>
      {(!online || ausCache) && (
        <div className="offline-leiste" role="status">
          {!online
            ? 'Offline – du siehst zuletzt geladene Daten. Beobachtungen und Zählungen werden gesendet, sobald du wieder Netz hast.'
            : 'Schlechte Verbindung – es werden gespeicherte Daten angezeigt.'}
        </div>
      )}
      {tipp && (
        <div className="offline-leiste offline-tipp" role="note">
          <span>Für die Nutzung ohne Netz: In Safari auf Teilen tippen, dann „Zum Home-Bildschirm“ wählen und die App von dort öffnen.</span>
          <button
            type="button"
            onClick={() => {
              setTipp(false);
              try { localStorage.setItem('waldmanager.tipp.installieren', '1'); } catch { /* egal */ }
            }}
          >
            OK
          </button>
        </div>
      )}
    </>
  );
}
