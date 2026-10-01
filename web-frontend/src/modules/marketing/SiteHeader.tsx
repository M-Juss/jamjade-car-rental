"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const navLinks = [
  { href: "#home", label: "Home" },
  { href: "#showcase", label: "Showcase" },
  { href: "#tutorial", label: "Guide" },
  { href: "#testimonials", label: "Reviews" },
  { href: "#visit", label: "Visit Us" },
];

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-[#f5f5f5]/90 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-8 lg:px-20">
        <div className="flex min-w-0 items-center gap-2">
          <span
            role="img"
            aria-label="JamJade Logo"
            className="size-12 shrink-0 bg-[linear-gradient(90deg,#004bfa_0%,#346ef6_50%)] [mask-image:url('/JamJadeLogo.png')] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]"
          />
          <p className="truncate bg-[linear-gradient(90deg,#004bfa_0%,#346ef6_50%)] bg-clip-text text-sm font-semibold text-transparent sm:text-lg">
            JAMJADE CAR RENTAL
          </p>
        </div>

        <nav
          aria-label="Main navigation"
          className="hidden items-center space-x-1 text-sm lg:flex"
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
            className="ml-2 inline-flex h-11 items-center rounded-md bg-[linear-gradient(90deg,#004bfa_0%,#346ef6_50%)] px-5 text-sm font-semibold text-white transition-all ease-in-out hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
          className="flex size-11 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:hidden"
        >
          {menuOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
        </button>
      </div>

      {menuOpen && (
        <nav
          id="mobile-menu"
          aria-label="Mobile navigation"
          className="border-t border-black/10 bg-white/95 px-4 py-3 backdrop-blur lg:hidden"
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
                className="flex min-h-11 w-full items-center justify-center rounded-md bg-[linear-gradient(90deg,#004bfa_0%,#346ef6_50%)] px-5 text-sm font-semibold text-white transition-all hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
