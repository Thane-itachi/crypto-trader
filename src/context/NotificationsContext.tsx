import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type NotifType = 'success' | 'error' | 'info' | 'warning';

export interface Notif {
  id: string;
  type: NotifType;
  title: string;
  body?: string;
  time: number;
  read: boolean;
}

interface NotificationsCtx {
  notifications: Notif[];
  unreadCount: number;
  notify: (type: NotifType, title: string, body?: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
}

const Ctx = createContext<NotificationsCtx | null>(null);

export function useNotifications(): NotificationsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const idRef = useRef(0);

  const notify = useCallback((type: NotifType, title: string, body?: string) => {
    const id = `${Date.now()}-${idRef.current++}`;
    setNotifications((prev) => {
      const next = [{ id, type, title, body, time: Date.now(), read: false }, ...prev];
      return next.slice(0, 50);
    });
    if (type === 'success' || type === 'error') {
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id || !n.read));
      }, 4500);
    }
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => setNotifications([]), []);

  // Auto-expire toasts (unseen ones) after ~10s so the center doesn't bloat
  useEffect(() => {
    const t = setInterval(() => {
      const cutoff = Date.now() - 60_000;
      setNotifications((prev) => prev.filter((n) => n.read || n.time > cutoff - 50_000));
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <Ctx.Provider value={{ notifications, unreadCount: notifications.filter((n) => !n.read).length, notify, markAllRead, clearAll }}>
      {children}
    </Ctx.Provider>
  );
}
