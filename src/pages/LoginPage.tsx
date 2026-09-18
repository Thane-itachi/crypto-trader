import { useState, FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CandlestickChart, Eye, EyeOff, MailCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button, Card } from '../components/ui';

export default function LoginPage() {
  const { user, signIn, googleSignIn, forgotPassword } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'signin' | 'forgot'>('signin');
  const [resetSent, setResetSent] = useState(false);

  if (user) {
    return <Navigate to="/app" replace />;
  }

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: err } = await forgotPassword(email.trim());
    setLoading(false);
    if (err) setError(err);
    else setResetSent(true);
  };

  const handleGoogle = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    const { error: err } = await googleSignIn();
    if (err) {
      setError(err);
      setLoading(false);
    } else {
      navigate('/app');
    }
  };

  const switchMode = (m: 'signin' | 'forgot') => {
    setMode(m);
    setResetSent(false);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError(null);

    const { error: err } = await signIn(email.trim(), password);

    if (err) {
      setError(err);
      setLoading(false);
    } else {
      navigate('/app');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4 sm:p-6">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-txt"
        >
          <ArrowLeft size={16} /> Back to home
        </Link>

        <Card className="p-6 sm:p-8 animate-card-in">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="animate-float mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-txt shadow-lg shadow-primary-600/25">
              <CandlestickChart size={28} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              {mode === 'signin' ? 'Welcome back' : 'Reset your password'}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {mode === 'signin'
                ? 'Sign in to your paper trading account'
                : "Enter your email and we'll send you a reset link"}
            </p>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-down/30 bg-down/10 p-3 text-sm text-down">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'forgot' && resetSent ? (
            <div className="space-y-5">
              <div className="flex items-start gap-2.5 rounded-lg border border-up/30 bg-up/10 p-3 text-sm text-up">
                <MailCheck size={18} className="mt-0.5 shrink-0" />
                <span>
                  If an account exists for <span className="font-semibold">{email}</span>, a password reset
                  link is on its way. Check your inbox (and spam folder).
                </span>
              </div>
              <Button variant="primary" className="w-full" onClick={() => switchMode('signin')}>
                Back to sign in
              </Button>
            </div>
          ) : (
          <>
          {mode === 'signin' && (
            <div className="mb-4 space-y-3">
              <button
                type="button"
                onClick={handleGoogle}
                disabled={loading}
                className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-line bg-white text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 disabled:opacity-60"
              >
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.665 4.673-6.126 8-11.303 8a12 12 0 1 1 8.472-20.472l5.657-5.657A19.998 19.998 0 1 0 24 44c11.046 0 20-8.954 20-20 0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="M6.306 14.691l6.571 4.818A12 12 0 0 1 24 12c2.674 0 5.127.885 7.126 2.374l5.657-5.657A19.955 19.955 0 0 0 24 4a19.998 19.998 0 0 0-17.694 10.691z"/><path fill="#4CAF50" d="M24 44a19.95 19.95 0 0 0 13.485-5.233l-6.229-5.267A11.917 11.917 0 0 1 24 36a12 12 0 0 1-11.244-7.775l-6.606 5.09A19.998 19.998 0 0 0 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.02 12.02 0 0 1-4.09 5.267l.003.001 6.229 5.267C36.501 38.505 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
                Continue with Google
              </button>
              <div className="flex items-center gap-3 text-xs text-muted">
                <span className="h-px flex-1 bg-line" />
                or sign in with email
                <span className="h-px flex-1 bg-line" />
              </div>
            </div>
          )}
          <form onSubmit={mode === 'signin' ? handleSubmit : handleForgot} className="space-y-4">
            <div className="animate-fade-in" style={{ animationDelay: '0.25s' }}>
              <label htmlFor="email" className="label">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input"
                autoComplete="email"
              />
            </div>

            {mode === 'signin' && (
            <div className="animate-fade-in" style={{ animationDelay: '0.35s' }}>
              <label htmlFor="password" className="label">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-txt"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="mt-1.5 text-right">
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-xs font-semibold text-primary-400 transition-colors hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            </div>
            )}

            <Button type="submit" variant="primary" loading={loading} className="animate-fade-in w-full" style={{ animationDelay: '0.45s' }}>
              {mode === 'signin' ? 'Sign In' : 'Send reset link'}
            </Button>
          </form>
          </>
          )}

          {mode === 'signin' && (
          <p className="animate-fade-in mt-6 text-center text-sm text-muted" style={{ animationDelay: '0.55s' }}>
            Don't have an account?{' '}
            <Link to="/signup" className="font-semibold text-primary-400 hover:underline">
              Sign up
            </Link>
          </p>)}

          {mode === 'forgot' && !resetSent && (
          <p className="mt-6 text-center text-sm text-muted">
            Remembered it?{' '}
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="font-semibold text-primary-400 hover:underline"
            >
              Back to sign in
            </button>
          </p>)}

          <div className="animate-fade-in mt-6 rounded-lg border border-primary-500/20 bg-primary-500/10 p-3 text-center" style={{ animationDelay: '0.65s' }}>
            <p className="text-xs font-semibold text-primary-400">
              Paper trading — $100,000 in DEMO FUNDS when you sign up.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
