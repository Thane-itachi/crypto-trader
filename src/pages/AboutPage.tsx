import { Link } from 'react-router-dom';
import {
  CandlestickChart,
  ShieldCheck,
  Globe2,
  ListCheck,
  Sparkles,
  ArrowRight,
  Coins,
  Banknote,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import PublicNav from '../components/PublicNav';
import { CRYPTO_ASSETS, FIAT_ASSETS } from '../lib/assets';
import { Card, Badge, Button } from '../components/ui';

export function AboutPage() {
  const roadmapItems = [
    {
      title: 'Advanced Order Types',
      status: 'Planned',
      description: 'Support for Limit, Stop-Loss, and Take-Profit orders to simulate disciplined trading execution.',
    },
    {
      title: 'Custom Price Alert Notifications',
      status: 'Planned',
      description: 'Configurable notifications when crypto or fiat assets cross defined price thresholds.',
    },
    {
      title: 'Portfolio Performance Analytics',
      status: 'Planned',
      description: 'In-depth historical portfolio metrics including Sharpe ratio, max drawdown, and asset weight distribution.',
    },
    {
      title: 'Community Leaderboards & Social Benchmarks',
      status: 'Planned',
      description: 'Opt-in public performance tracking to compare simulated portfolio returns against top paper traders.',
    },
  ];

  return (
    <div className="min-h-screen bg-bg text-txt flex flex-col">
      <PublicNav />

      <main className="flex-1 py-12 sm:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 space-y-16">
          {/* Header */}
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <Badge tone="accent" className="mx-auto">
              <Sparkles size={12} />
              About Crypto-Trader
            </Badge>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
              A Modern Environment for Paper Trading & Market Research
            </h1>
            <p className="text-muted text-base sm:text-lg leading-relaxed">
              Crypto-Trader was created to offer an accessible, zero-risk paper trading web application where users can track live cryptocurrency and currency prices, test strategies with virtual funds, and learn market dynamics.
            </p>
          </div>

          {/* Philosophy Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-primary-500" size={24} />
              <h2 className="text-2xl font-bold tracking-tight">The Paper Trading Philosophy</h2>
            </div>

            <Card className="p-6 sm:p-8 space-y-4 bg-surface">
              <p className="text-muted leading-relaxed text-sm sm:text-base">
                Trading digital assets requires understanding price volatility, order placement, and portfolio allocation. However, learning in live markets with real money often leads to unnecessary financial losses during early learning stages.
              </p>
              <p className="text-muted leading-relaxed text-sm sm:text-base">
                Our philosophy centers on <strong className="text-txt font-semibold">Risk-Free Market Education</strong>:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="rounded-xl border border-line bg-panel p-4 space-y-2">
                  <div className="flex items-center gap-2 text-primary-500 font-semibold text-sm">
                    <CheckCircle2 size={16} />
                    <span>Zero Financial Risk</span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    Every new account is credited with <span className="font-mono text-txt font-semibold">$10,000 in virtual DEMO FUNDS</span> to practice trades freely.
                  </p>
                </div>

                <div className="rounded-xl border border-line bg-panel p-4 space-y-2">
                  <div className="flex items-center gap-2 text-primary-500 font-semibold text-sm">
                    <CheckCircle2 size={16} />
                    <span>Behavioral Discipline</span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    Practice risk management, tracking profit/loss, and portfolio rebalancing without emotional anxiety or real-world loss.
                  </p>
                </div>
              </div>
            </Card>
          </section>

          {/* Markets Covered */}
          <section className="space-y-6">
            <div className="flex items-center gap-2">
              <Globe2 className="text-primary-500" size={24} />
              <h2 className="text-2xl font-bold tracking-tight">Markets Covered</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Crypto Assets */}
              <Card className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <Coins size={18} className="text-primary-500" />
                    <h3 className="font-bold text-base">Cryptocurrency Assets</h3>
                  </div>
                  <Badge tone="accent">{CRYPTO_ASSETS.length} Assets</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {CRYPTO_ASSETS.map((asset) => (
                    <div
                      key={asset.symbol}
                      className="flex items-center justify-between rounded-lg border border-line bg-panel px-3 py-2 text-xs"
                    >
                      <span className="font-bold text-txt">{asset.name}</span>
                      <span className="font-mono text-muted">{asset.symbol}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Fiat Currencies */}
              <Card className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <Banknote size={18} className="text-primary-500" />
                    <h3 className="font-bold text-base">Fiat Currencies</h3>
                  </div>
                  <Badge tone="neutral">{FIAT_ASSETS.length} Currencies</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {FIAT_ASSETS.map((asset) => (
                    <div
                      key={asset.symbol}
                      className="flex items-center justify-between rounded-lg border border-line bg-panel px-3 py-2 text-xs"
                    >
                      <span className="font-bold text-txt">{asset.name}</span>
                      <span className="font-mono text-muted">{asset.symbol}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </section>

          {/* Product Roadmap */}
          <section className="space-y-6">
            <div className="flex items-center gap-2">
              <ListCheck className="text-primary-500" size={24} />
              <h2 className="text-2xl font-bold tracking-tight">Planned Product Roadmap</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {roadmapItems.map((item, idx) => (
                <Card key={idx} className="p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">{item.title}</h3>
                    <Badge tone="neutral">
                      <Clock size={10} />
                      {item.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">{item.description}</p>
                </Card>
              ))}
            </div>
          </section>

          {/* CTA Box */}
          <section>
            <Card className="p-8 bg-panel border-line text-center space-y-4">
              <h2 className="text-2xl font-bold tracking-tight">Ready to start paper trading?</h2>
              <p className="text-muted text-sm max-w-xl mx-auto">
                Create your account in seconds and start practicing with $10,000 in virtual funds right away.
              </p>
              <div>
                <Link to="/signup">
                  <Button variant="primary" size="lg" className="gap-2">
                    Get Started Free <ArrowRight size={16} />
                  </Button>
                </Link>
              </div>
            </Card>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-line bg-surface py-12 mt-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-line">
            <Link to="/" className="flex items-center gap-2.5 font-bold tracking-tight">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-600 text-white">
                <CandlestickChart size={18} />
              </div>
              <span className="text-sm font-extrabold tracking-wider">CRYPTO-TRADER</span>
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
            <p>© {new Date().getFullYear()} Crypto-Trader. All rights reserved. Built for educational market simulation.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default AboutPage;
