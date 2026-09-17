import { useState, FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CandlestickChart, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button, Card } from '../components/ui';

export default function SignupPage() {
  const { user, signUp } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (user) {
    return <Navigate to="/app" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!displayName.trim()) {
      setError('Please enter your display name.');
      return;
    }

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setError(null);

    const { error: err } = await signUp(email.trim(), password, displayName.trim());

    setLoading(false);

    if (err) {
      setError(err);
    } else {
      setSuccess(true);
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
            <h1 className="text-2xl font-bold tracking-tight">Create an account</h1>
            <p className="mt-1 text-sm text-muted">Start paper trading with $10,000 in demo funds</p>
          </div>

          {success ? (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-up/10 text-up">
                <CheckCircle2 size={32} />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">Registration successful</h2>
                <p className="text-sm text-muted">
                  Account created. Check your email to confirm your account, then sign in.
                </p>
              </div>
              <Link to="/login" className="block w-full">
                <Button variant="primary" className="w-full">
                  Sign In
                </Button>
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-down/30 bg-down/10 p-3 text-sm text-down">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="displayName" className="label">
                    Display Name
                  </label>
                  <input
                    id="displayName"
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Satoshi Nakamoto"
                    className="input"
                    autoComplete="name"
                  />
                </div>

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

                <div>
                  <label htmlFor="password" className="label">
                    Password (min. 6 characters)
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="input pr-10"
                      autoComplete="new-password"
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
                  {password.length > 0 && password.length < 6 && (
                    <p className="mt-1 text-xs text-down">Password must be at least 6 characters</p>
                  )}
                </div>

                <Button type="submit" variant="primary" loading={loading} className="w-full">
                  Create Account
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-primary-400 hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}

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
