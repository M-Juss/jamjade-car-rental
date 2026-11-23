"use client";

import { useEffect, useState } from "react";
import { Pause, Play, Star } from "lucide-react";
import { getPublicFeedback } from "@/services/feedback/feedback.service";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";

const reviewBodyClassName = "flex min-h-[350px] flex-col items-center justify-center gap-7 px-6 pb-8 pt-20 text-center sm:min-h-[390px] sm:px-14 lg:px-20";

export default function TestimonialsCarousel() {
  const [result, setResult] = useState<(Awaited<ReturnType<typeof getPublicFeedback>> & { page: number }) | null>(null);
  const [page, setPage] = useState(1);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [paused, setPaused] = useState(false);
  const testimonials = result?.reviews ?? [];
  const [api, setApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    let current = true;
    void getPublicFeedback(page).then(value => {
      if (current) setResult(previous => ({ ...value, page, reviews: page === 1 ? value.reviews : [...(previous?.reviews ?? []), ...value.reviews.filter(review => !previous?.reviews.some(item => item.id === review.id))] }));
    }).catch(() => { if (current) setLoadError(true); });
    return () => { current = false; };
  }, [page, retry]);

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
    if (!api || !result || page !== result.page || testimonials.length < 2 || isHovered || hasFocus || prefersReducedMotion || paused) return;

    const timeout = window.setTimeout(() => {
      if (selectedIndex === testimonials.length - 1 && result && page < result.lastPage) {
        if (!loadError) setPage(value => value + 1);
      } else api.scrollNext();
    }, 5000);
    return () => window.clearTimeout(timeout);
  }, [api, selectedIndex, isHovered, hasFocus, prefersReducedMotion, paused, testimonials.length, page, result, loadError]);

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

      {testimonials.length ? <>
      <Carousel
        setApi={setApi}
        opts={{ align: "start", loop: true }}
        className="w-full"
        aria-label="Customer feedback"
        aria-live={paused || isHovered || hasFocus ? "polite" : "off"}
      >
        <CarouselContent className="ml-0">
          {testimonials.map((testimonial, index) => (
            <CarouselItem
              key={testimonial.id}
              className="pl-0"
              aria-label={`${index + 1} of ${testimonials.length}`}
              aria-hidden={index !== selectedIndex}
            >
              <div className={reviewBodyClassName}>
                <div className="flex gap-1.5 text-warning-border" role="img" aria-label={`Rated ${testimonial.rating} out of 5 stars`}>
                  {Array.from({ length: testimonial.rating }).map((_, starIndex) => (
                    <Star key={starIndex} className="size-5 fill-current sm:size-6" aria-hidden="true" />
                  ))}
                </div>
                <blockquote className="max-w-4xl text-xl leading-relaxed font-medium text-white [overflow-wrap:anywhere] sm:text-2xl lg:text-3xl">
                  “{testimonial.comment}”
                </blockquote>
                <div className="flex items-center gap-3 text-left">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white sm:size-14 sm:text-base">
                    {testimonial.name.split(" ").map(part => part[0]).join("")}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-white sm:text-base">{testimonial.name}</span>
                    <span className="block text-xs text-white/65 sm:text-sm">{"Verified rental"}</span>
                  </span>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      <div className="relative z-10 flex flex-wrap items-center justify-center gap-1 px-4 pb-8" role="group" aria-label="Choose a customer review">
        {testimonials.length > 1 ? <Button type="button" variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white" aria-label={paused ? "Play customer reviews" : "Pause customer reviews"} onClick={() => setPaused(value => !value)}>{paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}</Button> : null}
        {testimonials.map((testimonial, index) => (
          <button
            key={testimonial.id}
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
        {result && (page < result.lastPage || loadError) ? <Button type="button" variant="ghost" disabled={page > result.page && !loadError} className="text-white hover:bg-white/10 hover:text-white" onClick={() => { setLoadError(false); if (loadError) setRetry(value => value + 1); else setPage(value => value + 1); }}>{loadError ? "Retry" : page > result.page ? "Loading…" : "More reviews"}</Button> : null}
      </div>
      </> : <div className={reviewBodyClassName} role={loadError ? "alert" : "status"}>
        <p className="text-xl font-medium leading-relaxed sm:text-2xl">{loadError ? "Feedback could not be loaded." : result ? "No feedbacks yet" : "Loading feedback…"}</p>
        {loadError ? <Button type="button" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={() => { setLoadError(false); setRetry(value => value + 1); }}>Retry</Button> : null}
      </div>}
    </Card>
  );
}
