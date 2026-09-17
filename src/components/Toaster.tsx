import { useNotifications, type NotifType } from '../context/NotificationsContext';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

const ICONS: Record<NotifType, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const COLORS: Record<NotifType, string> = {
  success: 'text-up',
  error: 'text-down',
  info: 'text-primary-400',
  warning: 'text-amber-400',
};

export default function Toaster() {
  const { notifications, markAllRead } = useNotifications();
  // Only unread recent ones show as toasts; opening the center marks them read.
  const toasts = notifications.filter((n) => !n.read && Date.now() - n.time < 5000).slice(0, 4);

  return (
    <div className="pointer-events-none fixed right-4 top-16 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICONS[t.type];
        return (
          <div key={t.id} className="pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-xl">
            <Icon size={18} className={`mt-0.5 shrink-0 ${COLORS[t.type]}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-snug">{t.title}</p>
              {t.body && <p className="mt-0.5 text-xs leading-relaxed text-muted">{t.body}</p>}
            </div>
            <button
              onClick={() => markAllRead()}
              className="pointer-events-auto rounded p-1 text-muted hover:bg-panel"
              aria-label="Dismiss"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
