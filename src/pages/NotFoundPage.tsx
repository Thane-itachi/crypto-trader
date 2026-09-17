import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      <p className="font-mono text-6xl font-bold text-primary-500">404</p>
      <p className="text-lg font-semibold">Page not found</p>
      <p className="text-sm text-muted">The page you're looking for doesn't exist.</p>
      <Link to="/" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500">
        Back to home
      </Link>
    </div>
  );
}
