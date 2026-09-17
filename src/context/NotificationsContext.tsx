import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

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

const VALID_TYPES: NotifType[] = ['success', 'error', 'info', 'warning'];

/** Notifications are persisted to the Supabase `notifications` table per user:
 *  they survive refresh, logout/login, and sync read state. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const loadedForRef = useRef<string | null>(null);

  // Load the user's persisted notifications on sign-in / account switch
  useEffect(() => {
    const userId = user?.id ?? null;
    if (loadedForRef.current === userId) return;
    loadedForRef.current = userId;
    if (!userId) {
      setNotifications([]);
      return;
    }
    supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (!data) return;
        setNotifications(
          (data as { id: string; type: string; title: string; body: string | null; read: boolean; created_at: string }[]).map((r) => ({
            id: r.id,
            type: (VALID_TYPES.includes(r.type as NotifType) ? r.type : 'info') as NotifType,
            title: r.title,
            body: r.body ?? undefined,
            time: new Date(r.created_at).getTime(),
            read: r.read,
          })),
        );
      });
  }, [user?.id]);

  const notify = useCallback(
    (type: NotifType, title: string, body?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      // Instant session feedback (toast)
      setNotifications((prev) => [{ id, type, title, body, time: Date.now(), read: false }, ...prev].slice(0, 50));
      // Persist for the signed-in user (best-effort)
      if (user) {
        supabase
          .from('notifications')
          .insert({ title, body: body ?? null, type })
          .select('id')
          .then((res) => {
            const rows = res.data as unknown as { id: string }[] | null;
            if (rows && rows.length > 0) {
              const dbId = rows[0].id;
              // replace the temp id so read-state updates target the real row
              setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, id: dbId } : n)));
            }
          });
      }
    },
    [user],
  );

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (user) supabase.from('notifications').update({ read: true }).eq('read', false);
  }, [user]);

  const clearAll = useCallback(() => {
    setNotifications([]);
    if (user) supabase.from('notifications').delete();
  }, [user]);

  return (
    <Ctx.Provider
      value={{ notifications, unreadCount: notifications.filter((n) => !n.read).length, notify, markAllRead, clearAll }}
    >
      {children}
    </Ctx.Provider>
  );
}
