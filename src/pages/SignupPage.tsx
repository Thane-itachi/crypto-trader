import { useEffect, useRef, useState, FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ChevronDown, Mail, Phone as PhoneIcon, Search } from 'lucide-react';
import { AlertCircle, ArrowLeft, CandlestickChart, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button, Card } from '../components/ui';

function flagFor(iso2: string): string {
  return iso2
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join('');
}

interface CountryOption {
  dial: string;
  iso2: string;
  name: string;
}

const COUNTRY_OPTIONS: CountryOption[] = [
  { dial: '+212', iso2: 'MA', name: 'Morocco' },
  { dial: '+234', iso2: 'NG', name: 'Nigeria' },
  { dial: '+233', iso2: 'GH', name: 'Ghana' },
  { dial: '+254', iso2: 'KE', name: 'Kenya' },
  { dial: '+27', iso2: 'ZA', name: 'South Africa' },
  { dial: '+20', iso2: 'EG', name: 'Egypt' },
  { dial: '+213', iso2: 'DZ', name: 'Algeria' },
  { dial: '+216', iso2: 'TN', name: 'Tunisia' },
  { dial: '+221', iso2: 'SN', name: 'Senegal' },
  { dial: '+225', iso2: 'CI', name: "Côte d'Ivoire" },
  { dial: '+1', iso2: 'US', name: 'United States / Canada' },
  { dial: '+44', iso2: 'GB', name: 'United Kingdom' },
  { dial: '+33', iso2: 'FR', name: 'France' },
  { dial: '+34', iso2: 'ES', name: 'Spain' },
  { dial: '+49', iso2: 'DE', name: 'Germany' },
  { dial: '+39', iso2: 'IT', name: 'Italy' },
  { dial: '+31', iso2: 'NL', name: 'Netherlands' },
  { dial: '+41', iso2: 'CH', name: 'Switzerland' },
  { dial: '+91', iso2: 'IN', name: 'India' },
  { dial: '+92', iso2: 'PK', name: 'Pakistan' },
  { dial: '+880', iso2: 'BD', name: 'Bangladesh' },
  { dial: '+62', iso2: 'ID', name: 'Indonesia' },
  { dial: '+63', iso2: 'PH', name: 'Philippines' },
  { dial: '+90', iso2: 'TR', name: 'Turkey' },
  { dial: '+966', iso2: 'SA', name: 'Saudi Arabia' },
  { dial: '+971', iso2: 'AE', name: 'United Arab Emirates' },
  { dial: '+86', iso2: 'CN', name: 'China' },
  { dial: '+81', iso2: 'JP', name: 'Japan' },
  { dial: '+82', iso2: 'KR', name: 'South Korea' },
  { dial: '+61', iso2: 'AU', name: 'Australia' },
  { dial: '+55', iso2: 'BR', name: 'Brazil' },
  { dial: '+52', iso2: 'MX', name: 'Mexico' },
];

export default function SignupPage() {
  const { user, signUp, googleSignIn, sendPhoneCode, confirmPhoneCode } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [mode, setMode] = useState<'email' | 'phone'>('email');
  const [country, setCountry] = useState('+212');
  const [countryIso, setCountryIso] = useState('MA');
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const countryBoxRef = useRef<HTMLDivElement>(null);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpStep, setOtpStep] = useState<'phone' | 'otp'>('phone');

  const navigate = useNavigate();

  if (user) {
    return <Navigate to="/app" replace />;
  }

  const filteredCountries = COUNTRY_OPTIONS.filter((c) => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.iso2.toLowerCase().includes(q);
  });

  useEffect(() => {
    if (!countryOpen) return;
    const onClick = (e: MouseEvent) => {
      if (countryBoxRef.current && !countryBoxRef.current.contains(e.target as Node)) {
        setCountryOpen(false);
        setCountrySearch('');
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCountryOpen(false);
        setCountrySearch('');
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [countryOpen]);

  const handleSendCode = async () => {
    if (loading) return;
    if (!displayName.trim()) {
      setError('Please enter your display name.');
      return;
    }
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 6 || digits.length > 14) {
      setError('Please enter a valid phone number.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: err } = await sendPhoneCode(`${country}${digits}`);
    setLoading(false);
    if (err) setError(err);
    else setOtpStep('otp');
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (otp.trim().length < 6) {
      setError('Enter the 6-digit code from the SMS.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: err } = await confirmPhoneCode(otp.trim(), displayName.trim());
    if (err) {
      setError(err);
      setLoading(false);
    } else {
      navigate('/app');
    }
  };

  const switchMode2 = (m: 'email' | 'phone') => {
    setMode(m);
    setError(null);
    setOtpStep('phone');
    setOtp('');
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
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-panel p-1">
                  <button
                    type="button"
                    onClick={() => switchMode2('email')}
                    className={`flex h-9 items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors ${
                      mode === 'email' ? 'bg-primary-600 text-txt' : 'text-muted hover:text-txt'
                    }`}
                  >
                    <Mail size={15} /> Email
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode2('phone')}
                    className={`flex h-9 items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors ${
                      mode === 'phone' ? 'bg-primary-600 text-txt' : 'text-muted hover:text-txt'
                    }`}
                  >
                    <PhoneIcon size={15} /> Phone
                  </button>
                </div>
              </div>

              {mode === 'email' && (
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
              )}

              {mode === 'phone' && (
              <form onSubmit={otpStep === 'otp' ? handleVerify : (e) => { e.preventDefault(); handleSendCode(); }} className="space-y-4">
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

                {otpStep === 'phone' ? (
                  <div>
                    <label htmlFor="phone" className="label">
                      Phone number
                    </label>
                    <div
                      ref={countryBoxRef}
                      className="flex items-stretch overflow-visible rounded-lg border border-line bg-panel transition-colors focus-within:border-primary-500"
                    >
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => setCountryOpen((o) => !o)}
                          aria-haspopup="listbox"
                          aria-expanded={countryOpen}
                          aria-label="Select country code"
                          className="flex h-full items-center gap-1.5 rounded-l-lg border-r border-line px-3 text-sm text-txt transition-colors hover:bg-line/30"
                        >
                          <span className="text-base leading-none">{flagFor(countryIso)}</span>
                          <span className="font-medium tabular-nums">{country}</span>
                          <ChevronDown size={14} className={`text-muted transition-transform ${countryOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {countryOpen && (
                          <div className="absolute left-0 top-[calc(100%+6px)] z-20 w-64 overflow-hidden rounded-lg border border-line bg-surface shadow-xl shadow-black/30">
                            <div className="relative border-b border-line">
                              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                              <input
                                autoFocus
                                type="text"
                                value={countrySearch}
                                onChange={(e) => setCountrySearch(e.target.value)}
                                placeholder="Search country or code..."
                                className="h-9 w-full bg-transparent pl-9 pr-3 text-sm text-txt placeholder-muted outline-none"
                              />
                            </div>
                            <div className="max-h-56 overflow-y-auto py-1">
                              {filteredCountries.map((c) => (
                                <button
                                  key={c.iso2}
                                  type="button"
                                  onClick={() => {
                                    setCountry(c.dial);
                                    setCountryIso(c.iso2);
                                    setCountryOpen(false);
                                    setCountrySearch('');
                                  }}
                                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-line/40 ${
                                    c.iso2 === countryIso ? 'bg-primary-500/10 text-primary-400' : 'text-txt'
                                  }`}
                                >
                                  <span className="text-base leading-none">{flagFor(c.iso2)}</span>
                                  <span className="flex-1 truncate">{c.name}</span>
                                  <span className="tabular-nums text-muted">{c.dial}</span>
                                </button>
                              ))}
                              {filteredCountries.length === 0 && (
                                <p className="px-3 py-3 text-center text-sm text-muted">No matches</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <input
                        id="phone"
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="612 34 56 78"
                        className="flex-1 rounded-r-lg bg-transparent px-3 py-2.5 text-sm text-txt placeholder-muted outline-none"
                        autoComplete="tel-national"
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-muted">
                      We'll text you a 6-digit code to verify your number. Standard SMS rates may apply.
                    </p>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="otp" className="label">
                      Verification code
                    </label>
                    <input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••••"
                      className="input text-center font-mono tracking-[0.5em]"
                      autoComplete="one-time-code"
                    />
                    <p className="mt-1.5 text-xs text-muted">
                      Code sent to {country} {phone}.{' '}
                      <button
                        type="button"
                        onClick={() => { setOtpStep('phone'); setOtp(''); setError(null); }}
                        className="font-semibold text-primary-400 hover:underline"
                      >
                        Use a different number
                      </button>
                    </p>
                  </div>
                )}

                <Button type="submit" variant="primary" loading={loading} className="w-full">
                  {otpStep === 'otp' ? 'Verify & Create Account' : 'Send Code'}
                </Button>
                <div id="phone-recaptcha" />
              </form>
              )}

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
