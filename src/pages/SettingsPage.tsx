import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Moon, Sun, LogOut, ShieldAlert, DollarSign } from 'lucide-react';
import { useAuth, useTheme } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { Button, Card, PageHeader, Badge } from '../components/ui';
import { UserCircle, KeyRound, Eye, EyeOff } from 'lucide-react';
import AvatarPicker from '../components/AvatarPicker';

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60 disabled:opacity-50 ${
        checked ? 'bg-primary-600' : 'bg-panel border-line'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-txt shadow-sm transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { user, profile, updateProfile, signOut, changePassword } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { notify } = useNotifications();
  const navigate = useNavigate();

  const [updatingNotif, setUpdatingNotif] = useState<'notif_trades' | 'notif_market' | null>(null);
  const [signOutLoading, setSignOutLoading] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [changingPw, setChangingPw] = useState(false);

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (changingPw) return;
    if (!currentPw || !newPw || !confirmPw) {
      setPwError('Please fill in all three fields.');
      return;
    }
    if (newPw.length < 6) {
      setPwError('New password must be at least 6 characters.');
      return;
    }
    if (newPw !== confirmPw) {
      setPwError('New passwords do not match.');
      return;
    }
    if (newPw === currentPw) {
      setPwError('New password must be different from your current one.');
      return;
    }
    setChangingPw(true);
    setPwError(null);
    const { error } = await changePassword(currentPw, newPw);
    setChangingPw(false);
    if (error) {
      setPwError(error);
    } else {
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      notify('success', 'Password updated', 'Your password has been changed.');
    }
  };

  const handleToggleNotif = async (key: 'notif_trades' | 'notif_market') => {
    if (!profile) return;
    const newValue = !profile[key];
    setUpdatingNotif(key);

    const { error } = await updateProfile({ [key]: newValue });

    setUpdatingNotif(null);

    if (error) {
      notify('error', 'Failed to update preference', error);
    } else {
      const label = key === 'notif_trades' ? 'Trade notifications' : 'Market alerts';
      notify('success', 'Settings updated', `${label} ${newValue ? 'enabled' : 'disabled'}.`);
    }
  };

  const handleSignOut = async () => {
    setSignOutLoading(true);
    await signOut();
    navigate('/');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Manage display preferences, notifications, and trading mode"
      />

      <div className="grid gap-6 max-w-4xl">
        {/* Appearance Card */}
        <Card className="p-6">
          <div className="flex items-center gap-3 border-b border-line pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-panel text-primary-400">
              {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Appearance</h2>
              <p className="text-sm text-muted">Customize how Kryptova looks on your device</p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-txt">Theme Mode</p>
              <p className="text-sm text-muted">
                {theme === 'dark' ? 'Dark mode' : 'Light mode'} is currently active
              </p>
            </div>

            <Button
              type="button"
              variant="secondary"
              onClick={toggleTheme}
              className="gap-2"
            >
              {theme === 'dark' ? (
                <>
                  <Sun size={16} /> Light mode
                </>
              ) : (
                <>
                  <Moon size={16} /> Dark mode
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Profile Picture Card */}
        <Card className="p-6">
          <h3 className="mb-4 text-lg font-semibold tracking-tight flex items-center gap-2">
            <UserCircle size={18} /> Profile Picture
          </h3>
          <AvatarPicker
            avatarUrl={profile?.avatar_url ?? null}
            displayName={profile?.display_name}
            email={user?.email}
            sizeClass="h-16 w-16"
            onSet={async (url) => updateProfile({ avatar_url: url })}
          />
        </Card>

        {/* Notifications Card */}
        <Card className="p-6">
          <div className="flex items-center gap-3 border-b border-line pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-panel text-primary-400">
              <Bell size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Notifications</h2>
              <p className="text-sm text-muted">Manage in-app notifications and event alerts</p>
            </div>
          </div>

          <div className="mt-4 divide-y divide-line">
            <div className="flex items-center justify-between py-3.5">
              <div>
                <p className="font-medium text-txt">Trade notifications</p>
                <p className="text-sm text-muted">
                  Receive alerts when order executions or paper trades complete
                </p>
              </div>
              <ToggleSwitch
                checked={profile?.notif_trades ?? true}
                onChange={() => handleToggleNotif('notif_trades')}
                disabled={updatingNotif === 'notif_trades'}
                label="Trade notifications"
              />
            </div>

            <div className="flex items-center justify-between py-3.5">
              <div>
                <p className="font-medium text-txt">Market alerts</p>
                <p className="text-sm text-muted">
                  Receive notifications on significant crypto price movements and market data updates
                </p>
              </div>
              <ToggleSwitch
                checked={profile?.notif_market ?? true}
                onChange={() => handleToggleNotif('notif_market')}
                disabled={updatingNotif === 'notif_market'}
                label="Market alerts"
              />
            </div>
          </div>
        </Card>

        {/* Trading Card */}
        <Card className="p-6">
          <div className="flex items-center gap-3 border-b border-line pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-panel text-primary-400">
              <DollarSign size={20} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight">Trading Mode</h2>
                <Badge tone="accent">PAPER TRADING</Badge>
              </div>
              <p className="text-sm text-muted">Information about your simulated trading account</p>
            </div>
          </div>

          <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
            <p>
              Kryptova operates entirely in <strong className="text-txt">Demo / Paper Trading Mode</strong>.
              All account balances, trade executions, buy/sell orders, and portfolios use virtual funds.
            </p>
            <div className="rounded-lg border border-line bg-panel p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-txt">Starting Virtual Balance:</span>
                <span className="font-mono font-semibold text-up">$10,000.00 USD</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-txt">Real Funds Required:</span>
                <span className="font-semibold text-txt">None ($0.00)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-txt">Financial Risk:</span>
                <span className="font-semibold text-up">Zero Risk</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Change Password Card */}
        <Card className="p-6">
          <div className="flex items-center gap-3 border-b border-line pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/10 text-primary-400">
              <KeyRound size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Change Password</h2>
              <p className="text-sm text-muted">Update your sign-in password</p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
            {pwError && (
              <p className="rounded-lg border border-down/30 bg-down/10 p-2.5 text-sm text-down">{pwError}</p>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="currentPw" className="label">Current password</label>
                <input
                  id="currentPw"
                  type={showPw ? 'text' : 'password'}
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  autoComplete="current-password"
                  className="input"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label htmlFor="newPw" className="label">New password</label>
                <input
                  id="newPw"
                  type={showPw ? 'text' : 'password'}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  autoComplete="new-password"
                  className="input"
                  placeholder="At least 6 characters"
                />
              </div>
              <div>
                <label htmlFor="confirmPw" className="label">Confirm new password</label>
                <div className="relative">
                  <input
                    id="confirmPw"
                    type={showPw ? 'text' : 'password'}
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    autoComplete="new-password"
                    className="input pr-10"
                    placeholder="Repeat new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-txt"
                    aria-label={showPw ? 'Hide passwords' : 'Show passwords'}
                  >
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="primary" loading={changingPw}>
                <KeyRound size={16} /> Update password
              </Button>
            </div>
          </form>
        </Card>

        {/* Danger Zone Card */}
        <Card className="p-6 border-down/20">
          <div className="flex items-center gap-3 border-b border-line pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-down/10 text-down">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Danger Zone</h2>
              <p className="text-sm text-muted">Account session management</p>
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-medium text-txt">Sign out of account</p>
              <p className="text-sm text-muted">
                You will be redirected to the home page and need to sign back in.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              loading={signOutLoading}
              onClick={handleSignOut}
              className="border-down/30 text-down hover:bg-down/10 hover:border-down/50 shrink-0"
            >
              <LogOut size={16} /> Sign Out
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
