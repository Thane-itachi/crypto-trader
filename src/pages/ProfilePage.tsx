import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Save, User as UserIcon, Shield, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { Button, Card, PageHeader, Badge } from '../components/ui';

export default function ProfilePage() {
  const { user, profile, updateProfile, signOut } = useAuth();
  const { notify } = useNotifications();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '');
  const [saving, setSaving] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [signOutLoading, setSignOutLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '');
      setAvatarUrl(profile.avatar_url ?? '');
      setImgError(false);
    }
  }, [profile]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const { error } = await updateProfile({
      display_name: displayName.trim() || null,
      avatar_url: avatarUrl.trim() || null,
    });

    setSaving(false);

    if (error) {
      notify('error', 'Failed to update profile', error);
    } else {
      notify('success', 'Profile updated', 'Your profile details have been saved.');
    }
  };

  const handleSignOut = async () => {
    setSignOutLoading(true);
    await signOut();
    navigate('/');
  };

  const initial = (displayName.trim() || user?.email || 'U')[0].toUpperCase();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        subtitle="Manage your paper trading profile and account settings"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Main Profile Edit Card */}
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold tracking-tight">Personal Details</h2>

            <form onSubmit={handleSave} className="space-y-5">
              {/* Avatar Preview & URL */}
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <div className="relative shrink-0">
                  {avatarUrl && !imgError ? (
                    <img
                      src={avatarUrl}
                      alt={displayName || 'Avatar'}
                      onError={() => setImgError(true)}
                      className="h-20 w-20 rounded-full border-2 border-primary-500/30 object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-600 text-2xl font-bold text-txt">
                      {initial}
                    </div>
                  )}
                </div>

                <div className="w-full space-y-1">
                  <label htmlFor="avatarUrl" className="label">
                    Avatar Image URL
                  </label>
                  <input
                    id="avatarUrl"
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => {
                      setAvatarUrl(e.target.value);
                      setImgError(false);
                    }}
                    placeholder="https://example.com/avatar.jpg"
                    className="input"
                  />
                  <p className="text-xs text-muted">Direct link to an avatar image (JPEG, PNG, WebP)</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="displayName" className="label">
                    Display Name
                  </label>
                  <input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    className="input"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="label">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={user?.email ?? ''}
                    disabled
                    readOnly
                    className="input cursor-not-allowed text-muted opacity-80"
                  />
                  <p className="mt-1 text-xs text-muted">Email address cannot be changed directly.</p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" variant="primary" loading={saving}>
                  <Save size={16} /> Save Changes
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Account Info Sidebar Card */}
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold tracking-tight">Account Summary</h2>

            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <span className="text-muted">Account Type</span>
                <Badge tone="accent">Paper Trading</Badge>
              </div>

              <div className="flex items-center justify-between border-b border-line pb-3">
                <span className="text-muted">Signed-in Email</span>
                <span className="font-medium text-txt truncate max-w-[180px]" title={user?.email ?? ''}>
                  {user?.email ?? '—'}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-line pb-3">
                <span className="text-muted">Initial Funds</span>
                <span className="font-mono font-semibold text-up">$10,000.00</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted">Status</span>
                <span className="inline-flex items-center gap-1 font-medium text-up">
                  <CheckCircle2 size={14} /> Active
                </span>
              </div>
            </div>
          </Card>

          {/* Session / Danger Card */}
          <Card className="p-6">
            <h2 className="mb-2 text-lg font-semibold tracking-tight">Session</h2>
            <p className="mb-4 text-sm text-muted">
              Sign out of your paper trading account on this device.
            </p>
            <Button
              type="button"
              variant="outline"
              loading={signOutLoading}
              onClick={handleSignOut}
              className="w-full border-down/30 text-down hover:bg-down/10 hover:border-down/50"
            >
              <LogOut size={16} /> Sign Out
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
