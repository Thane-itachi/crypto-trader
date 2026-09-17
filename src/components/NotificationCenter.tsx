import { useState } from 'react';
import { Bell, Check } from 'lucide-react';
import { useNotifications } from '../context/NotificationsContext';
import { fmtTime } from '../lib/format';

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAllRead, clearAll } = useNotifications();

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative rounded-lg p-2 text-muted hover:bg-panel" aria-label="Notifications">
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-down px-1 text-[9px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-line bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="text-sm font-semibold">Notifications</span>
              <div className="flex gap-1">
                <button onClick={markAllRead} className="rounded p-1.5 text-muted hover:bg-panel" title="Mark all read">
                  <Check size={14} />
                </button>
                <button onClick={clearAll} className="rounded p-1.5 text-muted hover:bg-panel" title="Clear all">
                  ×
                </button>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">Nothing here yet.</p>}
              {notifications.map((n) => (
                <div key={n.id} className={`flex gap-3 border-b border-line px-4 py-3 last:border-0 ${n.read ? 'opacity-60' : ''}`}>
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      n.type === 'success' ? 'bg-up' : n.type === 'error' ? 'bg-down' : n.type === 'warning' ? 'bg-amber-400' : 'bg-primary-500'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs leading-relaxed text-muted">{n.body}</p>}
                    <p className="mt-1 text-[10px] text-muted">{fmtTime(n.time)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
