"use client";

import Image from "next/image";
import CarShowcase from "@/components/common/CarShowcase";
import BookingSteps from "@/components/common/BookingSteps";
import TestimonialCard from "@/components/common/TestimonialCard";
import { testimonials } from "@/lib/mock_data";
import { Map } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

const MotionLink = motion.create(Link);

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

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F5F5F5] flex flex-col ">
      <motion.header
        {...fadeUp(0)}
        className="fixed top-0 left-0 w-full z-50 px-20 py-3 bg-[#f5f5f5]/90 backdrop-blur flex items-center justify-between "
      >
        <p className="text-[#346EF6] text-lg font-semibold">
          JAMJADE CAR RENTAL
        </p>
        <div className="flex space-x-4 items-center text-sm">
          <nav className="space-x-5 text-black/60 ">
            <a
              href="#home"
              className="hover:text-black transition-colors ease-in"
            >
              Home
            </a>
            <a
              href="#showcase"
              className="hover:text-black transition-colors ease-in"
            >
              Showcase
            </a>
            <a
              href="#tutorial"
              className="hover:text-black transition-colors ease-in"
            >
              Guide
            </a>
            <a
              href="#testimonial"
              className="hover:text-black transition-colors ease-in"
            >
              Testimonial
            </a>
            <a
              href="#visit"
              className="hover:text-black transition-colors ease-in"
            >
              Visit Us
            </a>
          </nav>
          <Link href="/login"  className="text-sm text-white bg-[linear-gradient(90deg,#004bfa_0%,#346ef6_50%)] px-4 py-2 rounded-md hover:scale-102 transition-all ease-in-out ">
            LOGIN
          </Link>
        </div>
      </motion.header>

      <main>
        <section
          id="home"
          className="relative min-h-[92vh] overflow-hidden"
        >
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9 }}
          >
            <Image
              src="/JamJade-Hero.jpeg"
              alt="JamJade rental car ready for a trip"
              fill
              priority
              className="object-cover object-center brightness-110 saturate-105"
            />
            <div className="absolute inset-0 bg-white/20" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0.38)_43%,rgba(245,245,245,0.9)_100%)]" />
          </motion.div>

          <motion.div
            variants={heroStagger}
            initial="initial"
            animate="animate"
            className="relative z-10 mx-auto flex min-h-[92vh] max-w-5xl flex-col items-center justify-center px-6 pb-14 pt-28 text-center sm:px-10"
          >
            <motion.h1
              variants={heroItem}
              transition={{ duration: 0.5 }}
              className="max-w-4xl text-5xl font-bold leading-[0.95] text-neutral-950/80 sm:text-6xl lg:text-8xl"
            >
              Your Journey Starts with
              <span className="block italic text-[#346EF6]">JamJade</span>
            </motion.h1>
            <motion.p
              variants={heroItem}
              transition={{ duration: 0.45 }}
              className="mt-6 max-w-2xl text-base leading-7 text-neutral-700 sm:text-lg"
            >
              Experience the road like never before. Premium vehicle rentals
              tailored for your comfort, style, and budget.
            </motion.p>
            <motion.div
              variants={heroItem}
              transition={{ duration: 0.45 }}
              className="mt-8 flex flex-col items-center gap-3 sm:flex-row"
            >
              <MotionLink
                href="/login"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="min-w-32 rounded-md bg-[linear-gradient(90deg,#004bfa_0%,#346ef6_60%,#5a8cff_100%)] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all ease-in-out hover:-translate-y-0.5 hover:shadow-blue-500/30"
              >
                Rent Now
              </MotionLink>
              <motion.a
                href="#showcase"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="min-w-32 rounded-md border border-neutral-950/15 bg-white/70 px-5 py-3 text-sm font-semibold text-neutral-900 backdrop-blur transition-all ease-in-out hover:-translate-y-0.5 hover:bg-white"
              >
                View Fleet
              </motion.a>
            </motion.div>
            <motion.div
              variants={heroItem}
              transition={{ duration: 0.45 }}
              className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs font-medium uppercase tracking-[0.18em] text-neutral-600"
            >
              <span>Clean Cars</span>
              <span className="h-1 w-1 rounded-full bg-[#346EF6]" />
              <span>Flexible Booking</span>
              <span className="h-1 w-1 rounded-full bg-[#346EF6]" />
              <span>Local Support</span>
            </motion.div>
          </motion.div>
        </section>

        <motion.section
          {...revealUp(0)}
          id="showcase"
          className="py-20 px-20 flex flex-col "
        >
          <p className="font-semibold text-4xl mb-2">Select Your Excellence</p>
          <p className="text-sm mb-8 text-gray-600">
            Browse our hand-picked selection of premium vehicle for every
            occasion.
          </p>

          <div className="mx-auto w-full ">
            <CarShowcase />
          </div>
        </motion.section>

        <motion.section
          {...revealUp(0)}
          id="tutorial"
          className="py-20 px-20 grid grid-cols-2 bg-white/80"
        >
          <div className="flex flex-col">
            <p className="font-semibold text-4xl mb-8 w-145">
              How to Book Your Dream Car in 5 Easy Steps
            </p>
            <BookingSteps />
          </div>
        </motion.section>

        <motion.section
          {...revealUp(0)}
          id="testimonial"
          className="py-20 px-20 flex flex-col"
        >
          <p className="font-semibold text-4xl mb-2">Words of Praises</p>
          <p className="text-sm mb-8 text-gray-600">
            Hear from our satisfied customers and learn how our service made
            their trips easier and more enjoyable.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            {testimonials.map((testimonial, index) => (
              <div key={testimonial.fullName} className="contents">
                <div className="md:col-span-1 xl:col-span-1">
                  <TestimonialCard
                    fullName={testimonial.fullName}
                    description={testimonial.description}
                    profile={testimonial.profile}
                    stars={testimonial.stars}
                  />
                </div>
                <div
                  className={`hidden xl:block xl:col-span-1 ${
                    index % 2 === 0 ? "opacity-0" : ""
                  }`}
                  aria-hidden="true"
                />
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section
          {...revealUp(0)}
          id="visit"
          className="py-20 px-20 bg-white/80 relative "
        >
          <p className="font-semibold text-4xl mb-2">Come and Visit Us</p>
          <p className="text-sm mb-8 text-gray-600">
            Visit our location and explore our available cars up close. Our team
            is ready to assist you.
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
              9R8H+P3X jamjade rent a car services, Sahud-Ulan, Tanza, Cavite,
              4108{" "}
            </p>
            <p className="flex items-center space-x-2">
              {" "}
              <Map size={22} fill="#346EF6" className="text-blue-600" />{" "}
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

      <footer className="py-15 px-40 grid grid-cols-4 gap-20 ">
        <div className="flex flex-col">
          <p className="text-[#346EF6] font-semibold text-xl mb-5">
            JAMJADE CAR RENTAL
          </p>
          <p className="text-sm">
            Premium vehicle rentals for dicerning. Quality, trust, and speed in
            every mile
          </p>
        </div>

        <div className="flex flex-col">
          <p className="mb-5">NAVIGATION</p>
          <nav className="flex flex-col space-x-5 text-black">
            <a
              href="#home"
              className="hover:text-black transition-colors ease-in"
            >
              Home
            </a>
            <a
              href="#showcase"
              className="hover:text-black transition-colors ease-in"
            >
              Showcase
            </a>
            <a
              href="#tutorial"
              className="hover:text-black transition-colors ease-in"
            >
              Guide
            </a>
            <a
              href="#testimonial"
              className="hover:text-black transition-colors ease-in"
            >
              Testimonial
            </a>
            <a
              href="#visit"
              className="hover:text-black transition-colors ease-in"
            >
              Visit Us
            </a>
          </nav>
        </div>

        <div className="flex flex-col ">
          <p className="mb-5">CONTACT US</p>
          <p className="text-sm">Address</p>
          <p className="text-sm">Email</p>
          <p className="text-sm">Number</p>
        </div>
      </footer>
      <div className="border-t-1 py-3 text-center text-xs text-gray-400">
        © JAMJADE CAR RENTAL. All rigths reserved.
      </div>
    </div>
  );
}
