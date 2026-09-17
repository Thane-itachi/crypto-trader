import { Navigate, Route, Routes } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationsProvider } from './context/NotificationsContext';
import { MarketProvider } from './context/MarketContext';
import { PortfolioProvider } from './context/PortfolioContext';
import AppLayout from './components/layout/AppLayout';

// Route-level code splitting: each page loads on demand
const LandingPage = lazy(() => import('./pages/LandingPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const MarketsPage = lazy(() => import('./pages/MarketsPage'));
const AssetPage = lazy(() => import('./pages/AssetPage'));
const TradePage = lazy(() => import('./pages/TradePage'));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage'));
const WatchlistPage = lazy(() => import('./pages/WatchlistPage'));
const TransactionsPage = lazy(() => import('./pages/TransactionsPage'));
const ConverterPage = lazy(() => import('./pages/ConverterPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="animate-spin text-primary-500" />
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading, configured } = useAuth();
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Loader2 className="animate-spin text-primary-500" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (!configured)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
        <p className="text-lg font-semibold">Almost there</p>
        <p className="max-w-md text-sm text-muted">
          Crypto-Trader needs a Supabase project for accounts and demo portfolios. Create one at
          supabase.com, add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables,
          and run the SQL from supabase/schema.sql.
        </p>
      </div>
    );
  return <>{children}</>;
}

function ScrollToTop() {
  useEffect(() => window.scrollTo(0, 0), [location.pathname]);
  return null;
}

export default function App() {
  return (
    <NotificationsProvider>
      <AuthProvider>
        <MarketProvider>
          <PortfolioProvider>
            <ScrollToTop />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route
                  path="/app"
                  element={
                    <RequireAuth>
                      <AppLayout />
                    </RequireAuth>
                  }
                >
                  <Route index element={<DashboardPage />} />
                  <Route path="markets" element={<MarketsPage />} />
                  <Route path="asset/:symbol" element={<AssetPage />} />
                  <Route path="trade" element={<TradePage />} />
                  <Route path="portfolio" element={<PortfolioPage />} />
                  <Route path="watchlist" element={<WatchlistPage />} />
                  <Route path="transactions" element={<TransactionsPage />} />
                  <Route path="converter" element={<ConverterPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </PortfolioProvider>
        </MarketProvider>
      </AuthProvider>
    </NotificationsProvider>
  );
}
