import { Link } from 'react-router-dom';
import {
  TrendingUp,
  BarChart3,
  Wallet,
  Bookmark,
  ArrowLeftRight,
  Activity,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  CandlestickChart,
  Sparkles,
  DollarSign,
  Lock,
} from 'lucide-react';
import PublicNav from '../components/PublicNav';
import TickerTape from '../components/TickerTape';
import { useMarket } from '../context/MarketContext';
import { fmtPrice } from '../lib/format';
import { PriceChange } from '../components/market-bits';
import { Button, Card, Badge, Skeleton } from '../components/ui';

const PREVIEW_SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP'];

export function LandingPage() {
  const { getQuote, loading } = useMarket();

  const features = [
    {
      icon: TrendingUp,
      title: 'Real-Time Market Data',
      description:
        'Monitor live and simulated price tickers across top cryptocurrencies and major global fiat currencies.',
    },
    {
      icon: BarChart3,
      title: 'Interactive Price Charts',
      description:
        'Analyze historical price trends across multiple timeframes from 1 hour to 1 year with clean visualization.',
    },
    {
      icon: Wallet,
      title: 'Virtual Portfolio Management',
      description:
        'Track asset holdings, average buy prices, total portfolio value, and simulated profit/loss in real time.',
    },
    {
      icon: Bookmark,
      title: 'Custom Watchlist',
      description:
        'Pin your favorite trading pairs and keep a dedicated eye on key digital assets and currencies.',
    },
    {
      icon: ArrowLeftRight,
      title: 'Currency Converter',
      description:
        'Seamlessly convert amounts between cryptocurrencies and fiat currencies with instant rate calculations.',
    },
    {
      icon: Activity,
      title: 'Live Activity Stream',
      description:
        'Review complete transaction logs, execution records, and historical paper trades with full transparency.',
    },
  ];

  return (
    <div className="min-h-screen bg-bg text-txt flex flex-col">
      <PublicNav />
      <TickerTape />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3.5 py-1.5 text-xs font-semibold text-muted mb-6">
              <Sparkles size={14} className="text-primary-500" />
              <span>Modern Crypto & Fiat Paper Trading</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight max-w-4xl mx-auto leading-tight">
              Trade Smarter. Track Markets.{' '}
              <span className="text-primary-500">Take Control.</span>
            </h1>

            <p className="mt-6 text-base sm:text-lg text-muted max-w-2xl mx-auto leading-relaxed">
              Kryptova is a modern environment for monitoring crypto and currency markets and practicing trading with virtual funds. Master market mechanics without risking real capital.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link to="/signup">
                <Button variant="primary" size="lg" className="gap-2">
                  Get Started <ArrowRight size={18} />
                </Button>
              </Link>
              <Link to="/app/markets">
                <Button variant="outline" size="lg">
                  Explore Markets
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Paper Trading Explanation Section */}
        <section className="py-12 border-y border-line bg-surface/50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-2xl border border-line bg-panel p-8 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="space-y-3 max-w-2xl">
                <Badge tone="accent" className="w-fit">
                  <DollarSign size={12} />
                  Simulated Environment
                </Badge>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Start with <span className="font-mono text-primary-400">$10,000 DEMO FUNDS</span>
                </h2>
                <p className="text-sm sm:text-base text-muted leading-relaxed">
                  Every account receives $10,000 in virtual funds automatically upon signup. Practice executing buy and sell orders, test portfolio allocation strategies, and learn trading discipline — every single trade is 100% simulated.
                </p>
              </div>
              <div className="shrink-0">
                <Link to="/signup">
                  <Button variant="primary" size="lg">
                    Claim Demo Funds
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Market Preview Section */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Market Overview</h2>
                <p className="text-sm text-muted mt-1">
                  Live and simulated price previews for popular assets.
                </p>
              </div>
              <Badge tone="neutral" className="w-fit">
                <span className="font-mono">DEMO MODE</span> ACTIVE
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {PREVIEW_SYMBOLS.map((symbol) => {
                const quote = getQuote(symbol);
                return (
                  <Card key={symbol} className="p-5 transition-colors hover:border-primary-500/40">
                    {loading || !quote ? (
                      <div className="space-y-3">
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-7 w-32" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-base">{quote.symbol}</span>
                            <span className="text-xs text-muted block">{quote.name}</span>
                          </div>
                          <Badge tone={quote.isDemo ? 'accent' : 'neutral'}>
                            {quote.isDemo ? 'DEMO MODE' : 'LIVE'}
                          </Badge>
                        </div>
                        <div>
                          <p className="font-mono text-2xl font-bold">{fmtPrice(quote.price)}</p>
                          <div className="mt-1 flex items-center gap-2 text-xs">
                            <PriceChange value={quote.change24h} />
                            <span className="text-muted">24h</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 sm:py-20 border-t border-line bg-surface/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-3xl font-bold tracking-tight">Powerful Tools for Paper Traders</h2>
              <p className="mt-3 text-muted text-sm sm:text-base">
                Everything you need to track markets, simulate positions, and build confidence.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feat, i) => {
                const Icon = feat.icon;
                return (
                  <Card key={i} className="p-6 transition-colors hover:border-primary-500/40">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/10 text-primary-500 mb-4">
                      <Icon size={20} />
                    </div>
                    <h3 className="text-base font-semibold mb-2">{feat.title}</h3>
                    <p className="text-sm text-muted leading-relaxed">{feat.description}</p>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Security / Safe Paper Trading Section */}
        <section className="py-16 sm:py-20 border-t border-line">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <Badge tone="up">
                  <ShieldCheck size={14} />
                  Risk-Free Environment
                </Badge>
                <h2 className="text-3xl font-bold tracking-tight leading-tight">
                  Built for Safe Learning & Market Exploration
                </h2>
                <p className="text-muted leading-relaxed text-sm sm:text-base">
                  Kryptova is designed strictly for educational paper trading and market observation. You can experiment with trading concepts in a realistic interface without exposing capital to financial risk.
                </p>

                <div className="space-y-4 pt-2">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 text-primary-500">
                      <CheckCircle2 size={18} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">No Real Money Involved</p>
                      <p className="text-xs text-muted">All transactions use virtual balance. No credit cards or bank connections required.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="mt-1 text-primary-500">
                      <Lock size={18} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Clear Demo Data Labels</p>
                      <p className="text-xs text-muted">Demo prices and simulated trades are explicitly labeled throughout the platform.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="mt-1 text-primary-500">
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Realistic Trading Mechanics</p>
                      <p className="text-xs text-muted">Order calculations, portfolio balances, and transaction logs operate like a live exchange platform.</p>
                    </div>
                  </div>
                </div>
              </div>

              <Card className="p-8 bg-panel space-y-6">
                <div className="flex items-center gap-3 border-b border-line pb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600 text-white">
                    <CandlestickChart size={22} />
                  </div>
                  <div>
                    <p className="font-bold text-base">Kryptova Simulation Engine</p>
                    <p className="text-xs text-muted">Educational Platform Overview</p>
                  </div>
                </div>

                <div className="space-y-3 font-mono text-xs">
                  <div className="flex justify-between py-1.5 border-b border-line">
                    <span className="text-muted">Starting Balance</span>
                    <span className="font-semibold text-txt">$10,000.00 USD</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-line">
                    <span className="text-muted">Execution Type</span>
                    <span className="font-semibold text-txt">Instant Simulated Fill</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-line">
                    <span className="text-muted">Supported Asset Types</span>
                    <span className="font-semibold text-txt">Crypto + Fiat</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted">Real-Money Risk</span>
                    <span className="font-semibold text-up">$0.00 (Zero Risk)</span>
                  </div>
                </div>

                <Link to="/signup" className="block">
                  <Button variant="primary" className="w-full">
                    Create Free Paper Account
                  </Button>
                </Link>
              </Card>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-line bg-surface py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-line">
            <Link to="/" className="flex items-center gap-2.5 font-bold tracking-tight">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-600 text-white">
                <CandlestickChart size={18} />
              </div>
              <span className="brand-name text-sm font-extrabold tracking-wider">KRYPTOVA</span>
            </Link>

            <div className="flex flex-wrap items-center gap-6 text-sm text-muted">
              <Link to="/about" className="hover:text-txt transition-colors">
                About
              </Link>
              <Link to="/login" className="hover:text-txt transition-colors">
                Login
              </Link>
              <Link to="/signup" className="hover:text-txt transition-colors">
                Sign up
              </Link>
            </div>
          </div>

          <div className="pt-6 text-xs text-muted leading-relaxed space-y-2">
            <p>
              <strong>Disclaimer:</strong> Paper trading only. No real-money transactions. Not financial advice. Crypto assets are volatile.
            </p>
            <p>© {new Date().getFullYear()} Kryptova. All rights reserved. Built for educational market simulation.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
