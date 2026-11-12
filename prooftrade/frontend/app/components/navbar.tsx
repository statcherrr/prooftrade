import Link from 'next/link';

interface NavItem {
  href: string;
  label: string;
}

const navItems: NavItem[] = [
  { href: '/', label: 'Overview' },
  { href: '/', label: 'New Audit' },
  { href: '/', label: 'Audit Methodology' },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-0.5">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 text-[var(--color-accent-blue)]"
                aria-hidden="true"
              >
                <path
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 7.5h16.5M3.75 12h10.5M3.75 16.5h6.75"
                />
                <circle cx="20.25" cy="16.5" r="1.25" fill="currentColor" />
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-tight text-[var(--color-text-primary)]">
              ProofTrade
            </span>
          </Link>
        </div>

        <nav className="flex items-center gap-1" aria-label="Primary">
          {navItems.map((item) => (
            <span
              key={item.href}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
            >
              {item.label}
            </span>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="#"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 text-[var(--color-text-secondary)]"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.75" />
              <path
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
              />
            </svg>
            Settings
          </Link>
        </div>
      </div>
    </header>
  );
}
