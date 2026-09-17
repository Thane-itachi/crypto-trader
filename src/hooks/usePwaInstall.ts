import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * PWA install support. The browser fires `beforeinstallprompt` once the
 * manifest + service worker make the app installable; we capture it and
 * re-offer install through our own button. iOS Safari never fires it —
 * there the UI falls back to "Share → Add to Home Screen" instructions.
 */
export function usePwaInstall() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(display-mode: standalone)').matches,
  );

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    const mq = window.matchMedia('(display-mode: standalone)');
    const onMode = () => setInstalled(mq.matches);
    mq.addEventListener?.('change', onMode);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      mq.removeEventListener?.('change', onMode);
    };
  }, []);

  const isIos =
    typeof navigator !== 'undefined' &&
    (/iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' &&
        typeof (navigator as unknown as { standalone?: boolean }).standalone !== 'undefined'));

  const install = async (): Promise<'accepted' | 'dismissed' | null> => {
    if (!promptEvent) return null;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setPromptEvent(null);
    return outcome;
  };

  return { canInstall: !!promptEvent, install, installed, isIos };
}
