import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CandlestickChart, Menu, X } from 'lucide-react';
import { Button } from './ui';

export function PublicNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5 font-bold tracking-tight text-txt">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white">
            <CandlestickChart size={20} />
          </div>
          <span className="brand-name text-base font-extrabold tracking-wider">KRYPTOVA</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-6 md:flex">
          <Link to="/about" className="text-sm font-medium text-muted transition-colors hover:text-txt">
            About
          </Link>
          <Link to="/login" className="text-sm font-medium text-muted transition-colors hover:text-txt">
            Login
          </Link>
          <Link to="/signup">
            <Button variant="primary" size="sm">
              Sign up
            </Button>
          </Link>
        </nav>

        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-panel text-txt transition-colors hover:bg-panel/80 md:hidden"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div className="border-t border-line bg-surface px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            <Link
              to="/about"
              className="rounded-lg px-3 py-2 text-sm font-medium text-txt transition-colors hover:bg-panel"
              onClick={() => setMobileMenuOpen(false)}
            >
              About
            </Link>
            <Link
              to="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-txt transition-colors hover:bg-panel"
              onClick={() => setMobileMenuOpen(false)}
            >
              Login
            </Link>
            <Link
              to="/signup"
              className="mt-1"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Button variant="primary" className="w-full">
                Sign up
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export default PublicNav;
