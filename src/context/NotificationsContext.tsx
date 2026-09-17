import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
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

/** Notifications are persisted per user in Firestore (users/{uid}/notifications):
 *  they survive refresh, logout/login, and sync read state in real time. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const subbedForRef = useRef<string | null>(null);

  // Real-time listener on the user's persisted notifications
  useEffect(() => {
    const uid = user?.uid ?? null;
    if (subbedForRef.current === uid) return;
    subbedForRef.current = uid;
    if (!uid || !isFirebaseConfigured) {
      setNotifications([]);
      return;
    }
    const q = query(
      collection(db, 'users', uid, 'notifications'),
      orderBy('created_at', 'desc'),
      limit(30),
    );
    const unsub = onSnapshot(q, (snap) => {
      const items: Notif[] = snap.docs.map((d) => {
        const data = d.data();
        const type = data.type as string;
        const createdAt = data.created_at;
        return {
          id: d.id,
          type: (VALID_TYPES.includes(type as NotifType) ? type : 'info') as NotifType,
          title: (data.title as string) ?? '',
          body: (data.body as string | null) ?? undefined,
          time: typeof createdAt?.toMillis === 'function' ? createdAt.toMillis() : Date.now(),
          read: Boolean(data.read),
        };
      });
      setNotifications(items);
    });
    return unsub;
  }, [user?.uid]);

  const notify = useCallback(
    (type: NotifType, title: string, body?: string) => {
      // Instant session feedback
      const id = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setNotifications((prev) => [{ id, type, title, body, time: Date.now(), read: false }, ...prev].slice(0, 50));
      // Persist for the signed-in user (best-effort; the listener replaces the temp entry)
      if (user && isFirebaseConfigured) {
        addDoc(collection(db, 'users', user.uid, 'notifications'), {
          title,
          body: body ?? null,
          type,
          read: false,
          created_at: serverTimestamp(),
        }).catch(() => {});
      }
    },
    [user],
  );

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (!user || !isFirebaseConfigured) return;
    const unread = notifications.filter((n) => !n.read && !n.id.startsWith('tmp-'));
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    for (const n of unread) {
      batch.update(doc(db, 'users', user.uid, 'notifications', n.id), { read: true });
    }
    batch.commit().catch(() => {});
  }, [user, notifications]);

  const clearAll = useCallback(() => {
    setNotifications([]);
    if (!user || !isFirebaseConfigured) return;
    const owned = notifications.filter((n) => !n.id.startsWith('tmp-'));
    const batch = writeBatch(db);
    for (const n of owned) {
      batch.delete(doc(db, 'users', user.uid, 'notifications', n.id));
    }
    batch.commit().catch(() => {});
  }, [user, notifications]);

  return (
    <Ctx.Provider
      value={{ notifications, unreadCount: notifications.filter((n) => !n.read).length, notify, markAllRead, clearAll }}
    >
      {children}
    </Ctx.Provider>
  );
}
