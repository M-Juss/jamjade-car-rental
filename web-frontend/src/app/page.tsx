"use client";

import Image from "next/image";
import CarShowcase from "@/components/common/CarShowcase";
import BookingSteps from "@/components/common/BookingSteps";
import { Map, Phone, Mail, Clock, ChevronRight } from "lucide-react";
import { FaFacebook } from "react-icons/fa";
import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";
import DownloadAppModal from "@/components/common/DownloadAppModal";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay },
});

const revealUp = (delay = 0) => ({
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.18 },
  transition: { duration: 0.45, delay },
});

const heroStagger = {
  initial: {},
  animate: { transition: { staggerChildren: 0.1, delayChildren: 0.25 } },
};

const heroItem = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
};

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
    <div className="flex gap-0.5 mt-3">
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} width="16" height="16" viewBox="0 0 20 20" fill="#FBBF24">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function TestimonialCard({
  t,
  delay,
}: {
  t: (typeof testimonials)[0];
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.4, delay }}
      className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col"
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
          style={{ backgroundColor: t.avatarBg }}
        >
          {t.avatar}
        </div>
        <div>
          <p className="font-semibold text-sm text-gray-900">{t.name}</p>
          <p className="text-xs text-gray-500">{t.role}</p>
        </div>
      </div>
      <p className="text-sm text-gray-600 leading-relaxed flex-1">{t.review}</p>
      <StarRating count={t.stars} />
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);

  const topRow = testimonials.slice(0, 4);
  const bottomRow = testimonials.slice(4, 7);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F5F5F5] flex flex-col ">

      {/* ── Download App Modal ── */}
      <DownloadAppModal
        open={downloadModalOpen}
        onOpenChange={setDownloadModalOpen}
      />

      {/* ── Header ── */}
      <motion.header
        {...fadeUp(0)}
        className="fixed top-0 left-0 w-full z-50 px-20 py-1 bg-[#f5f5f5]/90 backdrop-blur flex items-center justify-between "
      >
        <div className="flex items-center gap-2">
          <Image
            src="/JamJadeLogo.png"
            alt="JamJade Logo"
            width={60}
            height={60}
            className="object-contain"
          />
          <p className="bg-[linear-gradient(90deg,#004bfa_0%,#346ef6_50%)] bg-clip-text text-transparent text-lg font-semibold">
            JAMJADE CAR RENTAL
          </p>
        </div>
        <div className="flex space-x-4 items-center text-sm">
          <nav className="space-x-5 text-black/60 ">
            <a href="#home" className="hover:text-black transition-colors ease-in">Home</a>
            <a href="#showcase" className="hover:text-black transition-colors ease-in">Showcase</a>
            <a href="#tutorial" className="hover:text-black transition-colors ease-in">Guide</a>
            <a href="#testimonials" className="hover:text-black transition-colors ease-in">Reviews</a>
            <a href="#visit" className="hover:text-black transition-colors ease-in">Visit Us</a>
          </nav>
          <Link
            href="/login"
            className="text-sm text-white bg-[linear-gradient(90deg,#004bfa_0%,#346ef6_50%)] px-4 py-2 rounded-md hover:scale-102 transition-all ease-in-out "
          >
            LOGIN
          </Link>
        </div>
      </motion.header>

      <main>
        {/* ── Hero ── */}
        <section id="home" className="relative min-h-screen overflow-hidden bg-neutral-950">
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.85 }}
          >
            <Image
              src="/JamJade-Hero.jpeg"
              alt="JamJade rental car ready for a trip"
              fill
              priority
              className="object-cover object-center brightness-[0.82] saturate-105"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,15,28,0.88)_0%,rgba(10,15,28,0.58)_46%,rgba(10,15,28,0.18)_100%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,15,28,0.2)_0%,rgba(10,15,28,0.08)_58%,rgba(245,245,245,0.95)_100%)]" />
          </motion.div>

          <motion.div
            variants={heroStagger}
            initial="initial"
            animate="animate"
            className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col justify-end px-6 pb-16 pt-28 sm:px-10 lg:px-20"
          >
            <motion.div
              variants={heroItem}
              transition={{ duration: 0.45 }}
              className="mb-4 inline-flex w-fit items-center gap-2 border-l-2 border-[#346EF6] pl-3 text-xs font-semibold uppercase text-white/75"
            >
              Premium car rentals in Cavite
            </motion.div>
            <motion.h1
              variants={heroItem}
              transition={{ duration: 0.5 }}
              className="max-w-4xl text-5xl font-bold leading-none text-white sm:text-6xl lg:text-8xl"
            >
              Your Journey Starts with
              <span className="block text-[#346EF6] italic">JamJade</span>
            </motion.h1>
            <motion.p
              variants={heroItem}
              transition={{ duration: 0.45 }}
              className="mt-6 max-w-2xl text-base leading-7 text-white/78 sm:text-lg"
            >
              Reliable daily and long-term rentals for business trips, family
              errands, and weekend drives, with vehicles prepared for comfort,
              safety, and easy booking.
            </motion.p>
            <motion.div
              variants={heroItem}
              transition={{ duration: 0.45 }}
              className="mt-8 flex flex-col gap-3 sm:flex-row"
            >
              <motion.button
                onClick={() => setDownloadModalOpen(true)}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="min-w-32 rounded-md bg-white px-5 py-3 text-center text-sm font-semibold text-[#1A2340] shadow-lg shadow-black/20 transition-all ease-in-out hover:-translate-y-0.5 hover:bg-[#EEF4FF] cursor-pointer"
              >
                Rent Now
              </motion.button>

              <motion.a
                href="#showcase"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="min-w-32 rounded-md border border-white/35 bg-white/10 px-5 py-3 text-center text-sm font-semibold text-white backdrop-blur transition-all ease-in-out hover:-translate-y-0.5 hover:bg-white/18"
              >
                View Fleet
              </motion.a>
            </motion.div>
            <motion.div
              variants={heroItem}
              transition={{ duration: 0.45 }}
              className="mt-12 flex flex-wrap items-center gap-5 text-xs font-medium uppercase text-white/70"
            >
              <span>Clean Cars</span>
              <span className="h-1 w-1 rounded-full bg-[#346EF6]" />
              <span>Flexible Booking</span>
              <span className="h-1 w-1 rounded-full bg-[#346EF6]" />
              <span>Local Support</span>
            </motion.div>
          </motion.div>
        </section>

        {/* ── Car Showcase ── */}
        <motion.section {...revealUp(0)} id="showcase" className="py-20 px-40 flex flex-col ">
          <p className="font-semibold text-4xl mb-2">Select Your Excellence</p>
          <p className="text-sm mb-8 text-gray-600">
            Browse our hand-picked selection of premium vehicle for every occasion.
          </p>
          <div className="mx-auto w-full ">
            <CarShowcase />
          </div>
        </motion.section>

        {/* ── How to Book ── */}
        <motion.section {...revealUp(0)} id="tutorial" className="py-20 px-40  bg-white/80">
          <div className="flex flex-col">
            <p className="font-semibold text-4xl mb-12 w-175">
              Book Your Dream Car in 5 Easy Steps
            </p>
            <BookingSteps />
          </div>
        </motion.section>

        {/* ── Testimonials ── */}
        <motion.section
          {...revealUp(0)}
          id="testimonials"
          className="py-20 px-40 bg-[#F5F5F5]"
        >
          <p className="font-semibold text-4xl mb-2">What Our Customers Say</p>
          <p className="text-sm mb-10 text-gray-600">
            Real experiences from real renters across Cavite and beyond.
          </p>

          {/* Top row — 4 cards */}
          <div className="grid grid-cols-4 gap-5 mb-5">
            {topRow.map((t, i) => (
              <TestimonialCard key={t.name} t={t} delay={i * 0.07} />
            ))}
          </div>

          {/* Bottom row — 3 cards centred */}
          <div className="grid grid-cols-3 gap-5 max-w-[75%] mx-auto">
            {bottomRow.map((t, i) => (
              <TestimonialCard key={t.name} t={t} delay={i * 0.07 + 0.28} />
            ))}
          </div>

          {/* Rating badge */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="mt-10 flex justify-center"
          >

          </motion.div>
        </motion.section>

        {/* ── Visit Us ── */}
        <motion.section {...revealUp(0)} id="visit" className="py-20 px-40 bg-white/80 relative ">
          <p className="font-semibold text-4xl mb-2">Come and Visit Us</p>
          <p className="text-sm mb-8 text-gray-600">
            Visit our location and explore our available cars up close. Our team is ready to assist you.
          </p>
          <div className="flex items-center justify-center ">
            <Image
              src={"/Gmap-Image.png"}
              alt="Gmap Location"
              width={1100}
              height={500}
              className=" rounded-2xl shadow-2xl"
            />
          </div>
          <div className="p-6 bg-white rounded-xl shadow-lg absolute flex flex-col bottom-40 left-20">
            <p className="font-semibold text-md mb-1">Visit our Showroom</p>
            <p className="text-xs w-60 mb-3">
              9R8H+P3X jamjade rent a car services, Sahud-Ulan, Tanza, Cavite, 4108{" "}
            </p>
            <p className="flex items-center space-x-2">
              <Map size={22} fill="#346EF6" className="text-blue-600" />
              <a
                target="_blank"
                className="text-[#346EF6] text-sm font-medium"
                href="https://www.google.com/maps/dir//jamjade+rent+a+car+services,+9R8H%2BP3X,+Sahud-Ulan,+Tanza,+Cavite,+tanza+cavite,+4108+Cavite/@14.3662062,120.8289549,15.69z/data=!4m16!1m7!3m6!1s0x33962b94daf6d49f:0xef9e1799b42c57c0!2sjamjade+rent+a+car+services!8m2!3d14.3668717!4d120.8277429!16s%2Fg%2F11c1t4v_gv!4m7!1m0!1m5!1m1!1s0x33962b94daf6d49f:0xef9e1799b42c57c0!2m2!1d120.8277749!2d14.3668309?entry=ttu&g_ep=EgoyMDI2MDQyOS4wIKXMDSoASAFQAw%3D%3D"
              >
                Get Directions
              </a>
            </p>
          </div>
        </motion.section>
      </main>

      {/* ── Footer ── */}
      <footer className="bg-[#0D1424] text-white pt-16 pb-10 px-20">
        <div className="max-w-7xl mx-auto grid grid-cols-4 gap-12 pb-12 border-b border-white/10">

          {/* Brand */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Image
                src="/JamJadeLogo.png"
                alt="JamJade Logo"
                width={44}
                height={44}
                className="object-contain brightness-0 invert"
              />
              <p className="text-[#346EF6] font-bold text-lg tracking-wide">
                JAMJADE
              </p>
            </div>
            <p className="text-white/60 text-sm leading-relaxed mb-5">
              Premium vehicle rentals in Cavite. Quality, trust, and safety in every mile you travel with us.
            </p>
            <a
              href="https://www.facebook.com/alvin.macalam2"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-[#346EF6] hover:text-blue-400 transition-colors"
            >
              <FaFacebook size={16} />
              Follow us on Facebook
            </a>
          </div>

          {/* Navigation */}
          <div className="flex flex-col">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-5">
              Navigation
            </p>
            <nav className="flex flex-col gap-3">
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
                  className="text-sm text-white/60 hover:text-white transition-colors flex items-center gap-1 group"
                >
                  <ChevronRight
                    size={12}
                    className="text-[#346EF6] opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                  {item.label}
                </a>
              ))}
            </nav>
          </div>

          {/* Contact */}
          <div className="flex flex-col">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-5">
              Contact Us
            </p>
            <div className="flex flex-col gap-4">
              <a href="tel:09186853429" className="flex items-start gap-3 group">
                <div className="w-8 h-8 rounded-lg bg-[#346EF6]/15 flex items-center justify-center flex-shrink-0 group-hover:bg-[#346EF6]/30 transition-colors">
                  <Phone size={14} className="text-[#346EF6]" />
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-0.5">Phone / Viber</p>
                  <p className="text-sm text-white/80 group-hover:text-white transition-colors">
                    0918 685 3429
                  </p>
                </div>
              </a>

              <a href="mailto:jamjade.carrentalofficial@gmail.com" className="flex items-start gap-3 group">
                <div className="w-8 h-8 rounded-lg bg-[#346EF6]/15 flex items-center justify-center flex-shrink-0 group-hover:bg-[#346EF6]/30 transition-colors">
                  <Mail size={14} className="text-[#346EF6]" />
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-0.5">Email</p>
                  <p className="text-sm text-white/80 group-hover:text-white transition-colors break-all">
                    jamjade.carrentalofficial@gmail.com
                  </p>
                </div>
              </a>

              <a
                href="https://www.facebook.com/alvin.macalam2"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 group"
              >
                <div className="w-8 h-8 rounded-lg bg-[#346EF6]/15 flex items-center justify-center flex-shrink-0 group-hover:bg-[#346EF6]/30 transition-colors">
                  <FaFacebook size={14} className="text-[#346EF6]" />
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-0.5">Facebook Page</p>
                  <p className="text-sm text-white/80 group-hover:text-white transition-colors">
                    JamJade Car Rental
                  </p>
                </div>
              </a>
            </div>
          </div>

          {/* Operating Hours */}
          <div className="flex flex-col">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-5">
              Operating Hours
            </p>
            <div className="flex items-start gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-[#346EF6]/15 flex items-center justify-center flex-shrink-0">
                <Clock size={14} className="text-[#346EF6]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white mb-1">Open 24 / 7</p>
                <p className="text-xs text-white/50 leading-relaxed">
                  Monday to Sunday — we're always here for your rental needs, day or night.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#346EF6]/15 flex items-center justify-center flex-shrink-0">
                <Map size={14} className="text-[#346EF6]" />
              </div>
              <div>
                <p className="text-xs text-white/40 mb-0.5">Address</p>
                <p className="text-sm text-white/70 leading-relaxed">
                  Sahud-Ulan, Tanza,<br />Cavite 4108
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="max-w-7xl mx-auto pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/30">
            © {new Date().getFullYear()} JamJade Car Rental. All rights reserved.
          </p>
          <div className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-white/40">Available 24/7</span>
          </div>
        </div>
      </footer>
    </div>
  );
}