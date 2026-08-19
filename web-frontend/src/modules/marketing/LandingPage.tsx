import Image from "next/image";
import CarShowcase from "@/modules/marketing/CarShowcase";
import BookingSteps from "@/modules/marketing/BookingSteps";
import SiteHeader from "@/modules/marketing/SiteHeader";
import RentNowButton from "@/modules/marketing/RentNowButton";
import { DownloadAppProvider } from "@/modules/marketing/DownloadAppProvider";
import { Map, Phone, Mail, Clock } from "lucide-react";
import { FaFacebook } from "react-icons/fa";

// ── Testimonials ──────────────────────────────────────────────────────────────
const testimonials = [
  {
    name: "Maria Santos",
    role: "Small Business Owner",
    avatar: "MS",
    avatarBg: "#346EF6",
    review:
      "JamJade made renting a car so hassle-free! The vehicle was spotless and the team was very accommodating. Will definitely rent again.",
    stars: 5,
  },
  {
    name: "Carlo Reyes",
    role: "Frequent Traveler",
    avatar: "CR",
    avatarBg: "#22c55e",
    review:
      "I needed a car last minute for a Tagaytay trip and JamJade delivered on time. The process was smooth and the price was fair.",
    stars: 5,
  },
  {
    name: "Ana Dela Cruz",
    role: "Event Coordinator",
    avatar: "AC",
    avatarBg: "#f97316",
    review:
      "We rented multiple vehicles for a corporate event and every single one was well-maintained. JamJade is our go-to rental service in Cavite.",
    stars: 5,
  },
  {
    name: "Joven Magpantay",
    role: "Family Man",
    avatar: "JM",
    avatarBg: "#8b5cf6",
    review:
      "Great experience from booking to return. The car was comfortable for our family road trip. Very trustworthy service!",
    stars: 5,
  },
  {
    name: "Trisha Villanueva",
    role: "OFW Returnee",
    avatar: "TV",
    avatarBg: "#ec4899",
    review:
      "Needed a reliable car for two weeks while visiting family. JamJade was affordable and professional. Highly recommend!",
    stars: 5,
  },
  {
    name: "Rodel Bautista",
    role: "Logistics Manager",
    avatar: "RB",
    avatarBg: "#14b8a6",
    review:
      "We use JamJade regularly for business trips around Cavite and Metro Manila. Always punctual and the vehicles are always in top shape.",
    stars: 5,
  },
  {
    name: "Sheila Gomez",
    role: "Real Estate Agent",
    avatar: "SG",
    avatarBg: "#f59e0b",
    review:
      "Booked through the app and everything went perfectly. Clean car, friendly service, and great rates. 5 stars all the way!",
    stars: 5,
  },
];

function StarRating({ count }: { count: number }) {
  return (
    <div className="mt-3 flex gap-0.5" role="img" aria-label={`Rated ${count} out of 5 stars`}>
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} width="16" height="16" viewBox="0 0 20 20" fill="#FBBF24" aria-hidden="true">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function TestimonialCard({
  t,
}: {
  t: (typeof testimonials)[0];
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ backgroundColor: t.avatarBg }}
        >
          {t.avatar}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{t.name}</p>
          <p className="text-xs text-gray-500">{t.role}</p>
        </div>
      </div>
      <p className="flex-1 text-sm leading-relaxed text-gray-600">{t.review}</p>
      <StarRating count={t.stars} />
    </div>
  );
}

const sectionHeading =
  "mb-2 text-3xl font-semibold sm:text-4xl";
const sectionSubtext = "mb-8 text-sm text-gray-600";
const sectionPadding = "px-4 py-16 sm:px-8 lg:px-40 lg:py-20";

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const topRow = testimonials.slice(0, 4);
  const bottomRow = testimonials.slice(4, 7);

  return (
    <DownloadAppProvider>
      <div className="flex min-h-screen flex-col overflow-x-hidden bg-background">
        <SiteHeader />

        <main>
          {/* ── Hero ── */}
          <section id="home" className="relative min-h-screen overflow-hidden bg-neutral-950">
            <div className="absolute inset-0">
              <Image
                src="/JamJade-Hero.jpeg"
                alt="JamJade rental car ready for a trip"
                fill
                priority
                sizes="100vw"
                className="object-cover object-center brightness-[0.82] saturate-105"
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,15,28,0.88)_0%,rgba(10,15,28,0.58)_46%,rgba(10,15,28,0.18)_100%)]" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,15,28,0.2)_0%,rgba(10,15,28,0.08)_58%,rgba(245,245,245,0.95)_100%)]" />
            </div>

            <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col justify-end px-6 pb-26 pt-28 sm:px-10 lg:px-20">
              <h1 className="max-w-4xl text-5xl font-bold leading-none text-white sm:text-6xl lg:text-8xl">
                Your Journey Starts with
                <span className="block text-primary">JamJade</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-white/78 sm:text-lg">
                Reliable daily and long-term rentals for business trips, family
                errands, and weekend drives, with vehicles prepared for comfort,
                safety, and easy booking.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <RentNowButton />

                <a
                  href="#showcase"
                  className="flex min-h-11 min-w-32 items-center justify-center rounded-md border border-white/35 bg-white/10 px-5 py-3 text-center text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/18 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  View Fleet
                </a>
              </div>
            </div>
          </section>

          {/* ── Car Showcase ── */}
          <section id="showcase" className={`flex flex-col scroll-mt-20 ${sectionPadding}`}>
            <p className={sectionHeading}>Select Your Excellence</p>
            <p className={sectionSubtext}>
              Browse our hand-picked selection of premium vehicle for every occasion.
            </p>
            <div className="mx-auto w-full">
              <CarShowcase />
            </div>
          </section>

          {/* ── How to Book ── */}
          <section id="tutorial" className={`scroll-mt-20 bg-white/80 ${sectionPadding}`}>
            <div className="flex flex-col">
              <p className={`mb-12 ${sectionHeading}`}>
                Book Your Dream Car in 5 Easy Steps
              </p>
              <BookingSteps />
            </div>
          </section>

          {/* ── Testimonials ── */}
          <section id="testimonials" className={`scroll-mt-20 bg-background ${sectionPadding}`}>
            <p className={sectionHeading}>What Our Customers Say</p>
            <p className={sectionSubtext}>
              Real experiences from real renters across Cavite and beyond.
            </p>

            <div className="mb-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {topRow.map((t) => (
                <TestimonialCard key={t.name} t={t} />
              ))}
            </div>

            <div className="mx-auto grid max-w-full grid-cols-1 gap-5 sm:grid-cols-2 lg:max-w-[75%] lg:grid-cols-3">
              {bottomRow.map((t) => (
                <TestimonialCard key={t.name} t={t} />
              ))}
            </div>
          </section>

          {/* ── Visit Us ── */}
          <section id="visit" className={`relative scroll-mt-20 bg-white/80 ${sectionPadding}`}>
            <p className={sectionHeading}>Come and Visit Us</p>
            <p className={sectionSubtext}>
              Visit our location and explore our available cars up close. Our team is ready to assist you.
            </p>
            <div className="flex items-center justify-center">
              <Image
                src={"/Gmap-Image.png"}
                alt="Map showing the JamJade showroom location"
                width={1100}
                height={500}
                sizes="(min-width: 1024px) 1100px, 100vw"
                className="h-auto w-full max-w-[1100px] rounded-2xl shadow-2xl"
              />
            </div>
            <div className="static mt-4 rounded-xl bg-white p-6 shadow-lg lg:absolute lg:bottom-40 lg:left-20 lg:mt-0">
              <p className="mb-1 font-semibold">Visit our Showroom</p>
              <p className="mb-3 w-full text-xs sm:w-60">
                9R8H+P3X jamjade rent a car services, Sahud-Ulan, Tanza, Cavite, 4108{" "}
              </p>
              <p className="flex items-center space-x-2">
                <Map size={22} fill="#346EF6" className="text-blue-600" aria-hidden="true" />
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-11 rounded-md px-2 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  href="https://www.google.com/maps/dir//jamjade+rent+a+car+services,+9R8H%2BP3X,+Sahud-Ulan,+Tanza,+Cavite,+tanza+cavite,+4108+Cavite/@14.3662062,120.8289549,15.69z/data=!4m16!1m7!3m6!1s0x33962b94daf6d49f:0xef9e1799b42c57c0!2sjamjade+rent+a+car+services!8m2!3d14.3668717!4d120.8277429!16s%2Fg%2F11c1t4v_gv!4m7!1m0!1m5!1m1!1s0x33962b94daf6d49f:0xef9e1799b42c57c0!2m2!1d120.8277749!2d14.3668309?entry=ttu&g_ep=EgoyMDI2MDQyOS4wIKXMDSoASAFQAw%3D%3D"
                >
                  Get Directions
                </a>
              </p>
            </div>
          </section>
        </main>

        {/* ── Footer ── */}
        <footer className="bg-[#0D1424] px-4 pb-4 pt-16 text-white sm:px-8 lg:px-20">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 border-b border-white/10 pb-12 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand */}
            <div className="flex flex-col">
              <div className="mb-4 flex items-center gap-2">
                <p className="text-lg font-bold tracking-wide text-primary">
                  JAMJADE CAR RENTAL
                </p>
              </div>
              <p className="mb-5 text-sm leading-relaxed text-white/60">
                Premium vehicle rentals in Cavite. Quality, trust, and safety in every mile you travel with us.
              </p>
              <a
                href="https://www.facebook.com/alvin.macalam2"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 py-2 text-sm text-primary transition-colors hover:text-blue-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <FaFacebook size={16} aria-hidden="true" />
                Follow us on Facebook
              </a>
            </div>

            {/* Navigation */}
            <div className="flex flex-col">
              <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-white/40">
                Navigation
              </p>
              <nav className="flex flex-col gap-1" aria-label="Footer navigation">
                {[
                  { href: "#home", label: "Home" },
                  { href: "#showcase", label: "Car Showcase" },
                  { href: "#tutorial", label: "How to Book" },
                  { href: "#testimonials", label: "Reviews" },
                  { href: "#visit", label: "Visit Us" },
                ].map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="flex min-h-11 items-center gap-1 rounded-md px-2 py-2 text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>

            {/* Contact */}
            <div className="flex flex-col">
              <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-white/40">
                Contact Us
              </p>
              <div className="flex flex-col gap-1">
                <a href="tel:09186853429" className="flex min-h-11 items-start gap-3 rounded-md px-2 py-2 group hover:bg-white/5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 transition-colors group-hover:bg-primary/30">
                    <Phone size={14} className="text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="mb-0.5 text-xs text-white/40">Phone / Viber</p>
                    <p className="text-sm text-white/80 transition-colors group-hover:text-white">
                      0918 685 3429
                    </p>
                  </div>
                </a>

                <a href="mailto:jamjade.carrentalofficial@gmail.com" className="flex min-h-11 items-start gap-3 rounded-md px-2 py-2 group hover:bg-white/5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 transition-colors group-hover:bg-primary/30">
                    <Mail size={14} className="text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="mb-0.5 text-xs text-white/40">Email</p>
                    <p className="break-all text-sm text-white/80 transition-colors group-hover:text-white">
                      jamjade.carrentalofficial@gmail.com
                    </p>
                  </div>
                </a>

                <a
                  href="https://www.facebook.com/alvin.macalam2"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-start gap-3 rounded-md px-2 py-2 group hover:bg-white/5"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 transition-colors group-hover:bg-primary/30">
                    <FaFacebook size={14} className="text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="mb-0.5 text-xs text-white/40">Facebook Page</p>
                    <p className="text-sm text-white/80 transition-colors group-hover:text-white">
                      JamJade Car Rental
                    </p>
                  </div>
                </a>
              </div>
            </div>

            {/* Operating Hours */}
            <div className="flex flex-col">
              <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-white/40">
                Operating Hours
              </p>
              <div className="mb-5 flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                  <Clock size={14} className="text-primary" aria-hidden="true" />
                </div>
                <div>
                  <p className="mb-1 text-sm font-semibold text-white">Open 24 / 7</p>
                  <p className="text-xs leading-relaxed text-white/50">
                    Monday to Sunday — we&apos;re always here for your rental needs, day or night.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                  <Map size={14} className="text-primary" aria-hidden="true" />
                </div>
                <div>
                  <p className="mb-0.5 text-xs text-white/40">Address</p>
                  <p className="text-sm leading-relaxed text-white/70">
                    Sahud-Ulan, Tanza,<br />Cavite 4108
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 pt-4 sm:flex-row">
            <p className="text-xs text-white/30">
              © {new Date().getFullYear()} JamJade Car Rental. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </DownloadAppProvider>
  );
}
