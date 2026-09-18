import { useRef, useState } from 'react';
import { ImagePlus, LayoutGrid, Plus, Trash2 } from 'lucide-react';
import { initialsFor, processAvatarFile } from '../lib/avatar';
import { useNotifications } from '../context/NotificationsContext';

/** Built-in avatars shipped with the app (public/avatars). */
export const PRESET_AVATARS = [
  { id: 'btc', label: 'Bitcoin', url: '/avatars/btc.png' },
  { id: 'eth', label: 'Ethereum', url: '/avatars/eth.png' },
  { id: 'sol', label: 'Solana', url: '/avatars/sol.png' },
  { id: 'doge', label: 'Doge', url: '/avatars/doge.png' },
  { id: 'candles', label: 'Candles', url: '/avatars/candles.png' },
  { id: 'moon', label: 'Moon', url: '/avatars/moon.png' },
  { id: 'bolt', label: 'Bolt', url: '/avatars/bolt.png' },
  { id: 'gem', label: 'Gem', url: '/avatars/gem.png' },
];

interface Props {
  avatarUrl: string | null;
  displayName?: string | null;
  email?: string | null;
  /** Persist the avatar (null = remove). Return { error } so the picker can toast. */
  onSet: (url: string | null) => Promise<{ error: string | null }>;
  sizeClass?: string;
}

export default function AvatarPicker({ avatarUrl, displayName, email, onSet, sizeClass = 'h-20 w-20' }: Props) {
  const { notify } = useNotifications();
  const [open, setOpen] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imgError, setImgError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async (url: string | null, successMsg: string) => {
    setBusy(true);
    const { error } = await onSet(url);
    setBusy(false);
    setOpen(false);
    setShowPresets(false);
    if (error) notify('error', 'Could not update picture', error);
    else notify('success', 'Picture updated', successMsg);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const res = await processAvatarFile(file);
    if ('error' in res) {
      notify('error', 'Could not use that picture', res.error);
      return;
    }
    await save(res.dataUrl, 'Your gallery picture is now your avatar.');
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setShowPresets(false); }}
        disabled={busy}
        className={`group relative shrink-0 ${sizeClass}`}
        aria-label="Change profile picture"
        title="Change profile picture"
      >
        {avatarUrl && !imgError ? (
          <img
            src={avatarUrl}
            alt="Your avatar"
            onError={() => setImgError(true)}
            className={`rounded-full border-2 border-primary-500/30 object-cover ${sizeClass}`}
          />
        ) : (
          <div className={`flex items-center justify-center rounded-full bg-primary-600 font-bold text-white ${sizeClass} text-[1.4rem]`}>
            {initialsFor(displayName, email)}
          </div>
        )}
        <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary-500 text-white ring-2 ring-bg transition-transform group-hover:scale-110">
          <Plus size={15} />
        </span>
      </button>

      {open && (
        <>
          <button type="button" className="fixed inset-0 z-20 cursor-default" onClick={() => setOpen(false)} aria-label="Close menu" />
          <div className="absolute left-0 top-full z-30 mt-2 w-64 rounded-xl border border-line bg-surface p-1.5 shadow-xl">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-txt transition-colors hover:bg-panel"
            >
              <ImagePlus size={16} className="text-primary-400" /> Add from gallery
            </button>
            <button
              type="button"
              onClick={() => setShowPresets((s) => !s)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-txt transition-colors hover:bg-panel"
            >
              <LayoutGrid size={16} className="text-primary-400" /> Kryptova avatars
            </button>
            {showPresets && (
              <div className="grid grid-cols-4 gap-2 p-2">
                {PRESET_AVATARS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    title={p.label}
                    onClick={() => save(p.url, `${p.label} avatar selected.`)}
                    className="overflow-hidden rounded-full ring-1 ring-line transition-all hover:scale-105 hover:ring-primary-400"
                  >
                    <img src={p.url} alt={p.label} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            {avatarUrl && (
              <button
                type="button"
                onClick={() => save(null, 'Your picture was removed.')}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-panel hover:text-down"
              >
                <Trash2 size={16} /> Remove picture
              </button>
            )}
          </div>
        </>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
