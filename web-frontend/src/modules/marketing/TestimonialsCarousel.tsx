"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";

const testimonials = [
  {
    name: "Maria Santos",
    role: "Small Business Owner",
    avatar: "MS",
    review:
      "JamJade made renting a car so hassle-free! The vehicle was spotless and the team was very accommodating. Will definitely rent again.",
    stars: 5,
  },
  {
    name: "Carlo Reyes",
    role: "Frequent Traveler",
    avatar: "CR",
    review:
      "I needed a car last minute for a Tagaytay trip and JamJade delivered on time. The process was smooth and the price was fair.",
    stars: 5,
  },
  {
    name: "Ana Dela Cruz",
    role: "Event Coordinator",
    avatar: "AC",
    review:
      "We rented multiple vehicles for a corporate event and every single one was well-maintained. JamJade is our go-to rental service in Cavite.",
    stars: 5,
  },
  {
    name: "Joven Magpantay",
    role: "Family Man",
    avatar: "JM",
    review:
      "Great experience from booking to return. The car was comfortable for our family road trip. Very trustworthy service!",
    stars: 5,
  },
  {
    name: "Trisha Villanueva",
    role: "OFW Returnee",
    avatar: "TV",
    review:
      "Needed a reliable car for two weeks while visiting family. JamJade was affordable and professional. Highly recommend!",
    stars: 5,
  },
  {
    name: "Rodel Bautista",
    role: "Logistics Manager",
    avatar: "RB",
    review:
      "We use JamJade regularly for business trips around Cavite and Metro Manila. Always punctual and the vehicles are always in top shape.",
    stars: 5,
  },
  {
    name: "Sheila Gomez",
    role: "Real Estate Agent",
    avatar: "SG",
    review:
      "Booked through the app and everything went perfectly. Clean car, friendly service, and great rates. 5 stars all the way!",
    stars: 5,
  },
];

export default function TestimonialsCarousel() {
  const [api, setApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updateMotionPreference();
    mediaQuery.addEventListener("change", updateMotionPreference);
    return () => mediaQuery.removeEventListener("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    if (!api) return;

    const updateSelection = () => setSelectedIndex(api.selectedScrollSnap());
    updateSelection();
    api.on("select", updateSelection);
    api.on("reInit", updateSelection);

    return () => {
      api.off("select", updateSelection);
      api.off("reInit", updateSelection);
    };
  }, [api]);

  useEffect(() => {
    if (!api || isHovered || hasFocus || prefersReducedMotion) return;

    const timeout = window.setTimeout(() => api.scrollNext(), 5000);
    return () => window.clearTimeout(timeout);
  }, [api, selectedIndex, isHovered, hasFocus, prefersReducedMotion]);

  return (
    <Card
      className="relative gap-0 rounded-3xl border border-white/20 bg-foreground py-0 text-white shadow-xl ring-0"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setHasFocus(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHasFocus(false);
      }}
    >
      <div className="absolute right-6 top-6 z-10 flex gap-2 sm:right-8 sm:top-8" aria-hidden="true">
        <span className="size-3 rounded-full bg-destructive" />
        <span className="size-3 rounded-full bg-warning-border" />
        <span className="size-3 rounded-full bg-success" />
      </div>

      <Carousel
        setApi={setApi}
        opts={{ align: "start", loop: true }}
        className="w-full"
        aria-label="Customer feedback"
        aria-live={isHovered || hasFocus ? "polite" : "off"}
      >
        <CarouselContent className="ml-0">
          {testimonials.map((testimonial, index) => (
            <CarouselItem
              key={testimonial.name}
              className="pl-0"
              aria-label={`${index + 1} of ${testimonials.length}`}
              aria-hidden={index !== selectedIndex}
            >
              <div className="flex min-h-[350px] flex-col items-center justify-center gap-7 px-6 pb-8 pt-20 text-center sm:min-h-[390px] sm:px-14 lg:px-20">
                <div className="flex gap-1.5 text-warning-border" role="img" aria-label={`Rated ${testimonial.stars} out of 5 stars`}>
                  {Array.from({ length: testimonial.stars }).map((_, starIndex) => (
                    <Star key={starIndex} className="size-5 fill-current sm:size-6" aria-hidden="true" />
                  ))}
                </div>
                <blockquote className="max-w-4xl text-xl leading-relaxed font-medium text-white sm:text-2xl lg:text-3xl">
                  “{testimonial.review}”
                </blockquote>
                <div className="flex items-center gap-3 text-left">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white sm:size-14 sm:text-base">
                    {testimonial.avatar}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-white sm:text-base">{testimonial.name}</span>
                    <span className="block text-xs text-white/65 sm:text-sm">{testimonial.role}</span>
                  </span>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      <div className="relative z-10 flex items-center justify-center gap-1 pb-8" role="group" aria-label="Choose a customer review">
        {testimonials.map((testimonial, index) => (
          <button
            key={testimonial.name}
            type="button"
            className="flex size-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            aria-label={`Show review from ${testimonial.name}`}
            aria-pressed={index === selectedIndex}
            onClick={() => api?.scrollTo(index)}
          >
            <span
              className={`h-2.5 rounded-full transition-all motion-reduce:transition-none ${index === selectedIndex ? "w-8 bg-primary" : "w-2.5 bg-white/60 hover:bg-white"}`}
            />
          </button>
        ))}
      </div>
    </Card>
  );
}
