import Image from "next/image";
import { Button } from "@/components/ui/button";
import CarShowcase from "@/modules/marketing/CarShowcase";
import BookingSteps from "@/modules/marketing/BookingSteps";
import DrivingInsights from "@/modules/marketing/DrivingInsights";
import TestimonialsCarousel from "@/modules/marketing/TestimonialsCarousel";
import SiteHeader from "@/modules/marketing/SiteHeader";
import RentNowButton from "@/modules/marketing/RentNowButton";
import { DownloadAppProvider } from "@/modules/marketing/DownloadAppProvider";
import { Map, Phone, Mail, Clock } from "lucide-react";
import { FaFacebook } from "react-icons/fa";

const sectionHeader = "mb-7 border-b border-border pb-5";
const sectionHeading = "mb-2 text-3xl font-semibold sm:text-4xl";
const sectionSubtext = "text-sm text-muted-foreground";
const sectionPadding = "px-4 py-16 sm:px-8 lg:px-40 lg:py-20";

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <DownloadAppProvider>
      <div className="flex min-h-screen flex-col overflow-x-hidden bg-background">
        <SiteHeader />

        <main>
          {/* ── Hero ── */}
          <section
            id="home"
            aria-labelledby="hero-heading"
            className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-background pt-16"
          >
            <div className="relative z-10 mx-auto w-full max-w-[1400px] shrink-0 px-4 pb-6 pt-8 sm:px-8 sm:pt-10 lg:px-20 lg:pb-16 lg:pt-[clamp(2rem,7dvh,5rem)]">
              <div className="max-w-xl lg:w-[52%] lg:max-w-[640px]">
                <h1
                  id="hero-heading"
                  className="text-[clamp(2.75rem,13vw,3.5rem)] font-bold leading-[1.05] tracking-tight text-foreground text-shadow-lg text-shadow-foreground/20 sm:text-7xl lg:text-[clamp(3rem,min(6.5vw,10dvh),6rem)]"
                >
                  Your Journey
                  <span className="block">Starts with</span>
                  <span className="block text-primary text-shadow-lg text-shadow-primary/25">JamJade</span>
                </h1>
                <p className="mt-6 max-w-md text-base leading-7 text-muted-foreground sm:text-lg lg:max-w-[min(32rem,38vw)] lg:text-xl lg:leading-8">
                  Reliable daily and long-term rentals for business trips, family
                  errands, and weekend drives, with vehicles prepared for comfort,
                  safety, and easy booking.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <RentNowButton />
                  <Button asChild variant="outline" className="min-h-12 min-w-32 px-6 text-sm font-semibold">
                    <a href="#showcase">View Fleet</a>
                  </Button>
                </div>
              </div>
            </div>

            <div className="relative min-h-48 w-full flex-1 lg:absolute lg:bottom-0 lg:left-[15%] lg:right-0 lg:top-16 lg:min-h-0 lg:w-auto">
              <Image
                src="/Hero-Image.png"
                alt="JamJade rental fleet with a silver van, family car, and sedan"
                fill
                preload
                sizes="100vw"
                className="object-cover object-right lg:object-contain lg:object-right-bottom"
              />
            </div>
          </section>

          {/* ── Car Showcase ── */}
          <section id="showcase" className={`flex flex-col scroll-mt-20 bg-muted/30 ${sectionPadding}`}>
            <div className="mx-auto w-full">
              <CarShowcase />
            </div>
          </section>

          <section
            id="driving-insights"
            aria-labelledby="driving-insights-heading"
            className={`scroll-mt-20 bg-background ${sectionPadding}`}
          >
            <div className={sectionHeader}>
              <h2 id="driving-insights-heading" className={sectionHeading}>
                More insight every journey.
              </h2>
              <p className={sectionSubtext}>
                AI driving-event classification brings vehicle movement and journey
                context together to help our team understand each rental journey.
              </p>
            </div>
            <DrivingInsights />
          </section>

          {/* ── How to Book ── */}
          <section id="tutorial" className={`scroll-mt-20 bg-white/80 ${sectionPadding}`}>
            <div className={sectionHeader}>
              <h2 className={sectionHeading}>
                Book Your Dream Car in 5 Easy Steps
              </h2>
              <p className={sectionSubtext}>
                From downloading the app to driving away, here is how to rent with JamJade.
              </p>
            </div>
            <BookingSteps />
          </section>

          {/* ── Testimonials ── */}
          <section id="testimonials" className={`scroll-mt-20 bg-muted/30 ${sectionPadding}`}>
            <div className={sectionHeader}>
              <h2 className={sectionHeading}>What Our Customers Say</h2>
              <p className={sectionSubtext}>
                Real experiences from real renters across Cavite and beyond.
              </p>
            </div>
            <TestimonialsCarousel />
          </section>

          {/* ── Visit Us ── */}
          <section id="visit" className={`relative scroll-mt-20 bg-white/80 ${sectionPadding}`}>
            <div className={sectionHeader}>
              <h2 className={sectionHeading}>Come and Visit Us</h2>
              <p className={sectionSubtext}>
                Visit our location and explore our available cars up close. Our team is ready to assist you.
              </p>
            </div>
            <div className="flex items-center justify-center">
              <iframe
                title="Map showing the JamJade showroom pin"
                src="https://maps.google.com/maps?q=jamjade+rent+a+car+services,+Sahud-Ulan,+Tanza,+Cavite&ll=14.3668717,120.8277429&z=17&output=embed"
                width="600"
                height="450"
                className="h-[450px] w-full max-w-[1100px] rounded-2xl border-0 shadow-2xl"
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
            <div className="static mt-4 rounded-xl bg-white p-6 shadow-lg lg:absolute lg:bottom-40 lg:left-20 lg:mt-0">
              <p className="mb-1 font-semibold">Visit our Showroom</p>
              <p className="mb-3 w-full text-xs sm:w-60">
                9R8H+P3X jamjade rent a car services, Sahud-Ulan, Tanza, Cavite, 4108{" "}
              </p>
              <p className="flex items-center space-x-2">
                <Map size={22} fill="#FFFFFF" className="text-blue" aria-hidden="true" />
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  className=" rounded-md px-2 py-2 text-sm font-medium  text-black transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  href="https://www.google.com/maps/dir//jamjade+rent+a+car+services,+9R8H%2BP3X,+Sahud-Ulan,+Tanza,+Cavite,+tanza+cavite,+4108+Cavite/@14.3662062,120.8289549,15.69z/data=!4m16!1m7!3m6!1s0x33962b94daf6d49f:0xef9e1799b42c57c0!2sjamjade+rent+a+car+services!8m2!3d14.3668717!4d120.8277429!16s%2Fg%2F11c1t4v_gv!4m7!1m0!1m5!1m1!1s0x33962b94daf6d49f:0xef9e1799b42c57c0!2m2!1d120.8277749!2d14.3668309?entry=ttu&g_ep=EgoyMDI2MDQyOS4wIKXMDSoASAFQAw%3D%3D"
                >
                  Get Directions
                </a>
              </p>
            </div>
          </section>
        </main>

        {/* ── Footer ── */}
        <footer className="bg-foreground px-4 pb-4 pt-16 text-white sm:px-8 lg:px-20">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 border-b border-white/10 pb-12 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand */}
            <div className="flex flex-col">
              <div className="mb-4 flex items-center gap-2">
                <Image
                  src="/JamJadeLogo-solid.png"
                  alt=""
                  width={48}
                  height={48}
                  sizes="48px"
                  className="size-12 shrink-0 rounded-md bg-surface object-contain"
                />
                <p className="text-lg font-bold tracking-wide text-white">
                  JAMJADE CAR RENTAL
                </p>
              </div>
              <p className="mb-5 text-sm leading-relaxed text-white/80">
                Premium vehicle rentals in Cavite. Quality, trust, and safety in every mile you travel with us.
              </p>
              <a
                href="https://www.facebook.com/alvin.macalam2"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 py-2 text-sm text-white transition-colors hover:text-blue-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <FaFacebook size={16} aria-hidden="true" />
                Follow us on Facebook
              </a>
            </div>

            {/* Navigation */}
            <div className="flex flex-col">
              <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-white/70">
                Navigation
              </p>
              <nav className="flex flex-col gap-1" aria-label="Footer navigation">
                {[
                  { href: "#home", label: "Home" },
                  { href: "#showcase", label: "Car Showcase" },
                  { href: "#driving-insights", label: "Driving Insights" },
                  { href: "#tutorial", label: "How to Book" },
                  { href: "#testimonials", label: "Reviews" },
                  { href: "#visit", label: "Visit Us" },
                ].map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="flex min-h-11 items-center gap-1 rounded-md px-2 py-2 text-sm text-white/80 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>

            {/* Contact */}
            <div className="flex flex-col">
              <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-white/70">
                Contact Us
              </p>
              <div className="flex flex-col gap-1">
                <a href="tel:09186853429" className="flex min-h-11 items-start gap-3 rounded-md px-2 py-2 group hover:bg-white/5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 transition-colors group-hover:bg-primary/30">
                    <Phone size={14} className="text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="mb-0.5 text-xs text-white/70">Phone / Viber</p>
                    <p className="text-sm text-white/80 transition-colors group-hover:text-white">
                      0918 685 3429
                    </p>
                  </div>
                </a>

                <a href="mailto:ofcl.jamjadecarrental@gmail.com" className="flex min-h-11 items-start gap-3 rounded-md px-2 py-2 group hover:bg-white/5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 transition-colors group-hover:bg-primary/30">
                    <Mail size={14} className="text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="mb-0.5 text-xs text-white/70">Email</p>
                    <p className="break-all text-sm text-white/80 transition-colors group-hover:text-white">
                      ofcl.jamjadecarrental@gmail.com
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
                    <p className="mb-0.5 text-xs text-white/70">Facebook Page</p>
                    <p className="text-sm text-white/80 transition-colors group-hover:text-white">
                      JamJade Car Rental
                    </p>
                  </div>
                </a>
              </div>
            </div>

            {/* Operating Hours */}
            <div className="flex flex-col">
              <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-white/70">
                Operating Hours
              </p>
              <div className="mb-5 flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                  <Clock size={14} className="text-primary" aria-hidden="true" />
                </div>
                <div>
                  <p className="mb-1 text-sm font-semibold text-white">Open 24 / 7</p>
                  <p className="text-xs leading-relaxed text-white/75">
                    Monday to Sunday — we&apos;re always here for your rental needs, day or night.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                  <Map size={14} className="text-primary" aria-hidden="true" />
                </div>
                <div>
                  <p className="mb-0.5 text-xs text-white/70">Address</p>
                  <p className="text-sm leading-relaxed text-white/85">
                    Sahud-Ulan, Tanza,<br />Cavite 4108
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-4 pt-4 sm:flex-row">
            <p className="text-xs text-white/70">
              © {new Date().getFullYear()} JamJade Car Rental. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </DownloadAppProvider>
  );
}
