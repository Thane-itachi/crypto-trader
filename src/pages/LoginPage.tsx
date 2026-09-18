import { useState, FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CandlestickChart, Eye, EyeOff, MailCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button, Card } from '../components/ui';

export default function LoginPage() {
  const { user, signIn, forgotPassword } = useAuth();
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

        <Card className="p-6 sm:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-txt">
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
          <form onSubmit={mode === 'signin' ? handleSubmit : handleForgot} className="space-y-4">
            <div>
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
            <div>
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

            <Button type="submit" variant="primary" loading={loading} className="w-full">
              {mode === 'signin' ? 'Sign In' : 'Send reset link'}
            </Button>
          </form>
          )}

          {mode === 'signin' && (
          <p className="mt-6 text-center text-sm text-muted">
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

          <div className="mt-6 rounded-lg border border-primary-500/20 bg-primary-500/10 p-3 text-center">
            <p className="text-xs font-semibold text-primary-400">
              Paper trading — $10,000 in DEMO FUNDS when you sign up.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
