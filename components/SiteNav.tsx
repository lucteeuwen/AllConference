"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoTile } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { ReactNode } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const items: NavItem[] = [
  {
    href: "/",
    label: "Home",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" {...stroke}>
        <path d="M4 10.5L12 4l8 6.5" />
        <path d="M6 9.8V20h12V9.8" />
        <path d="M10 20v-5h4v5" />
      </svg>
    ),
  },
  {
    href: "/matches",
    label: "Matches",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" {...stroke}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 3.5l3 3.2-1.2 4H10.2L9 6.7z" />
        <path d="M20 9.5l-3.2 1.2M4 9.5l3.2 1.2M8.3 19.6l1.9-3.4M15.7 19.6l-1.9-3.4" />
      </svg>
    ),
  },
  {
    href: "/standings",
    label: "Standings",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" {...stroke}>
        <path d="M4 20h16" />
        <rect x="5" y="12" width="4" height="6" rx="1" />
        <rect x="10" y="8" width="4" height="10" rx="1" />
        <rect x="15" y="4" width="4" height="14" rx="1" />
      </svg>
    ),
  },
  {
    href: "/teams",
    label: "Teams",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" {...stroke}>
        <circle cx="9" cy="9" r="3.2" />
        <path d="M3.5 19a5.5 5.5 0 0111 0" />
        <path d="M16 6.4a3 3 0 010 5.6M17.5 19a5.6 5.6 0 00-2.2-4.4" />
      </svg>
    ),
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Bottom tab bar on phones, a top bar from the medium breakpoint up. */
export function SiteNav() {
  const pathname = usePathname();

  return (
    <>
      <header className="bc-sticky sticky top-0 z-40 hidden border-b border-line bg-navy md:block">
        <div className="mx-auto flex h-16 items-center gap-8 px-6" style={{ maxWidth: "var(--page-max)" }}>
          <Link href="/" className="flex items-center gap-2.5">
            <LogoTile className="size-9" />
            <span className="text-[15px] font-bold tracking-tight text-white">
              CCIW Men&apos;s Soccer
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isActive(pathname, item.href)
                    ? "bg-white/12 text-white"
                    : "text-white/60 hover:bg-white/8 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <ThemeToggle tone="onDark" className="ml-auto" />
        </div>
      </header>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="flex">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition ${
                    active ? "text-accent" : "text-ink-faint"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
