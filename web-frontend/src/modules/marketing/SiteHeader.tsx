"use client";

import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const navLinks = [
  { href: "#home", label: "Home" },
  { href: "#showcase", label: "Showcase" },
  { href: "#driving-insights", label: "Driving Insights" },
  { href: "#tutorial", label: "Guide" },
  { href: "#visit", label: "Visit Us" },
];

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-background">
      <div className="mx-auto flex min-h-16 w-full max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-8 lg:px-20">
        <div className="flex min-w-0 items-center gap-2">
          <Image
            src="/JamJadeLogo-solid.png"
            alt="JamJade Logo"
            width={48}
            height={48}
            sizes="48px"
            className="size-12 shrink-0 object-contain"
          />
          <p className="truncate text-sm font-semibold text-primary sm:text-lg">
            JAMJADE CAR RENTAL
          </p>
        </div>

        <nav
          aria-label="Main navigation"
          className="hidden items-center space-x-1 text-sm xl:flex"
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-black/60 transition-colors ease-in hover:bg-white/70 hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {link.label}
            </a>
          ))}
          <Link
            href="/login"
            className="ml-2 inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-white transition-all ease-in-out hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            LOGIN
          </Link>
        </nav>

        <button
          type="button"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? "Close main menu" : "Open main menu"}
          onClick={() => setMenuOpen((open) => !open)}
          className="flex size-11 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary xl:hidden"
        >
          {menuOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
        </button>
      </div>

      {menuOpen && (
        <nav
          id="mobile-menu"
          aria-label="Mobile navigation"
          className="border-t border-border bg-background px-4 py-3 xl:hidden"
        >
          <ul className="flex flex-col">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-black/70 transition-colors hover:bg-black/5 hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {link.label}
                </a>
              </li>
            ))}
            <li className="mt-2 border-t border-black/10 pt-3">
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-white transition-all hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                LOGIN
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
