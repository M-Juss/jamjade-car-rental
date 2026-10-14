"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Cog, Fuel, Armchair, Palette } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { getAvailableShowcaseVehicles, type ShowcaseVehicle } from "@/services/vehicle";

export default function CarShowcase() {
  const [vehicles, setVehicles] = useState<ShowcaseVehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [api, setApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    let ignore = false;

    getAvailableShowcaseVehicles()
      .then((records) => {
        if (!ignore) setVehicles(records);
      })
      .catch(() => {
        if (!ignore) setError("Available vehicles could not be loaded.");
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
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

  const goToPreviousVehicle = () => {
    if (!api) return;

    if (api.canScrollPrev()) {
      api.scrollPrev();
    } else {
      api.scrollTo(vehicles.length - 1, true);
    }
  };

  const goToNextVehicle = () => {
    if (!api) return;

    if (api.canScrollNext()) {
      api.scrollNext();
    } else {
      api.scrollTo(0, true);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-7 flex items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h2 className="mb-2 text-3xl font-semibold sm:text-4xl">Select Your Excellence</h2>
          <p className="text-sm text-muted-foreground">
            Browse our hand-picked selection of premium vehicles for every occasion.
          </p>
        </div>
        {!isLoading && !error && vehicles.length > 0 && (
          <p className="shrink-0 font-mono text-xl tabular-nums text-foreground sm:text-3xl" aria-live="polite">
            {String(selectedIndex + 1).padStart(2, "0")}
            <span className="text-muted-foreground">/{String(vehicles.length).padStart(2, "0")}</span>
          </p>
        )}
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading available vehicles...</p>
      ) : error ? (
        <p className="py-12 text-center text-sm text-destructive">{error}</p>
      ) : vehicles.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No vehicles are currently available.</p>
      ) : (
        <>
          <Carousel
            setApi={setApi}
            opts={{ align: "center", containScroll: false, loop: vehicles.length > 2 }}
            className="w-full"
            aria-label="Available vehicles"
            onKeyDownCapture={(event) => {
              if (event.target instanceof Element && event.target.closest('[data-vehicle-specs]')) {
                return;
              }
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                goToPreviousVehicle();
              } else if (event.key === "ArrowRight") {
                event.preventDefault();
                goToNextVehicle();
              }
            }}
          >
            <CarouselContent className="items-center">
              {vehicles.map((vehicle, index) => {
                const image = vehicle.cardImage ?? vehicle.image ?? vehicle.images?.find(Boolean);
                const isSelected = selectedIndex === index;

                return (
                  <CarouselItem
                    key={vehicle.id}
                    aria-label={`${index + 1} of ${vehicles.length}`}
                    className="basis-[86%] sm:basis-[64%] lg:basis-[54%] xl:basis-[44%]"
                  >
                    <Card
                      className={`my-3 h-[440px] gap-0 rounded-3xl border-0 py-0 shadow-xl ring-0 transition-[transform,opacity] duration-500 ease-out motion-reduce:transition-none sm:h-[500px] lg:h-[560px] ${
                        isSelected ? "scale-100 opacity-100" : "scale-[0.78] opacity-55"
                      }`}
                    >
                      <div className="relative min-h-0 flex-1 overflow-hidden bg-muted">
                        {image ? (
                          <Image
                            src={image}
                            alt={vehicle.name}
                            fill
                            sizes="(min-width: 1280px) 44vw, (min-width: 1024px) 54vw, (min-width: 640px) 64vw, 86vw"
                            unoptimized
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            No vehicle image
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/90 to-transparent px-6 pb-6 pt-20 sm:px-8">
                          <div className="flex items-end justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="text-2xl font-semibold text-white sm:text-4xl">{vehicle.name}</h3>
                              <p className="mt-0.5 text-sm text-white/85">
                                {vehicle.brand}{vehicle.model ? ` ${vehicle.model}` : ""}
                              </p>
                            </div>
                            <p className="shrink-0 text-right text-xl font-bold text-white sm:text-2xl">
                              ₱{Number(vehicle.pricePerDay).toLocaleString()}
                              <span className="block text-xs font-normal text-white/85">/ day</span>
                            </p>
                          </div>
                        </div>
                      </div>
                      <CardContent className="px-4 py-5 sm:px-6 sm:py-6">
                        <div
                          data-vehicle-specs
                          role="region"
                          aria-label={`${vehicle.name} specifications`}
                          tabIndex={0}
                          className="flex items-center justify-between gap-0.5 overflow-x-auto rounded-sm text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:gap-3 sm:text-sm">
                          <p className="flex shrink-0 items-center gap-1 whitespace-nowrap sm:gap-1.5"><Palette className="size-3.5 shrink-0 text-primary sm:size-4" aria-hidden="true" /><span className="font-semibold text-foreground">{vehicle.color || "Not specified"}</span></p>
                          <Separator orientation="vertical" className="h-4 data-vertical:self-center" />
                          <p className="flex shrink-0 items-center gap-1 whitespace-nowrap sm:gap-1.5"><Armchair className="size-3.5 shrink-0 text-primary sm:size-4" aria-hidden="true" /><span className="font-semibold text-foreground">{vehicle.seats} seater</span></p>
                          <Separator orientation="vertical" className="h-4 data-vertical:self-center" />
                          <p className="flex shrink-0 items-center gap-1 whitespace-nowrap sm:gap-1.5"><Cog className="size-3.5 shrink-0 text-primary sm:size-4" aria-hidden="true" /><span className="font-semibold text-foreground">{vehicle.transmission}</span></p>
                          <Separator orientation="vertical" className="h-4 data-vertical:self-center" />
                          <p className="flex shrink-0 items-center gap-1 whitespace-nowrap sm:gap-1.5"><Fuel className="size-3.5 shrink-0 text-primary sm:size-4" aria-hidden="true" /><span className="font-semibold text-foreground">{vehicle.fuelType}</span></p>
                        </div>
                      </CardContent>
                    </Card>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
            {vehicles.length > 1 && (
              <>
                <CarouselPrevious
                  className="left-1 z-10 size-11 border-0 bg-surface/90 text-foreground shadow-lg backdrop-blur hover:bg-surface sm:left-3"
                  disabled={!api}
                  onClick={goToPreviousVehicle}
                />
                <CarouselNext
                  className="right-1 z-10 size-11 border-0 bg-surface/90 text-foreground shadow-lg backdrop-blur hover:bg-surface sm:right-3"
                  disabled={!api}
                  onClick={goToNextVehicle}
                />
              </>
            )}
          </Carousel>
          {vehicles.length > 1 && (
            <div className="mt-3 flex items-center justify-center gap-2" aria-hidden="true">
              {vehicles.map((vehicle, index) => (
                <span
                  key={vehicle.id}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === selectedIndex ? "w-10 bg-primary" : "w-5 bg-border"
                  }`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
