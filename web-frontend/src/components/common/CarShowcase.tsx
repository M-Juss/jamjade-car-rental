"use client";

import { useEffect, useState } from "react";
import { Cog, Fuel, Armchair, Palette } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { apiGet } from "@/services/http";

type ShowcaseVehicle = {
  id: string;
  name: string;
  pricePerDay: number;
  seats: number;
  color?: string | null;
  transmission: string;
  fuelType: string;
  cardImage?: string | null;
  image?: string | null;
  images?: (string | null)[];
};

export default function CarShowcase() {
  const [vehicles, setVehicles] = useState<ShowcaseVehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    apiGet<ShowcaseVehicle[]>("/api/mobile/vehicles?status=available&per_page=12")
      .then((response) => {
        if (!ignore) setVehicles(response.data);
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

  if (isLoading) {
    return <p className="py-12 text-center text-sm text-gray-500">Loading available vehicles...</p>;
  }

  if (error) {
    return <p className="py-12 text-center text-sm text-rose-600">{error}</p>;
  }

  if (vehicles.length === 0) {
    return <p className="py-12 text-center text-sm text-gray-500">No vehicles are currently available.</p>;
  }

  return (
    <Carousel
      opts={{
        align: "start",
        loop: true,
      }}
      className="w-full"
    >
      <CarouselContent>
        {vehicles.map((vehicle) => {
          const image = vehicle.cardImage ?? vehicle.image ?? vehicle.images?.find(Boolean);

          return (
            <CarouselItem
              key={vehicle.id}
              className="basis-full sm:basis-1/2 lg:basis-1/4 gap-5"
            >
              <div className="w-full h-fit max-w-sm rounded-2xl my-2 shadow-md overflow-hidden bg-white">
                {image ? (
                  <img
                    src={image}
                    alt={vehicle.name}
                    className="w-full h-60 object-cover"
                  />
                ) : (
                  <div className="flex h-60 items-center justify-center bg-gray-100 text-sm text-gray-500">
                    No vehicle image
                  </div>
                )}

                <div className="p-4 flex flex-col space-y-2">
                  <div className="flex justify-between mb-3">
                    <h2 className="text-lg font-semibold">{vehicle.name}</h2>
                    <p className="text-base font-bold text-blue-600">
                      ₱{Number(vehicle.pricePerDay).toLocaleString()}{" "}
                      <span className="text-gray-400 text-xs">/ Day</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <p className="text-sm text-gray-500 flex gap-2 items-center">
                      <Armchair size={23} className="text-gray-600" />
                      {vehicle.seats} seater
                    </p>
                    <p className="text-sm text-gray-500 flex gap-2 items-center">
                      <Palette size={23} className="text-gray-600" />
                      {vehicle.color || "Not specified"}
                    </p>
                    <p className="text-sm text-gray-500 flex gap-2 items-center">
                      <Cog size={23} className="text-gray-600" />
                      {vehicle.transmission}
                    </p>
                    <p className="text-sm text-gray-500 flex gap-2 items-center">
                      <Fuel size={23} className="text-gray-600" />
                      {vehicle.fuelType}
                    </p>
                  </div>
                </div>
              </div>
            </CarouselItem>
          );
        })}
      </CarouselContent>
      <CarouselPrevious className="-left-12 h-30 w-8" />
      <CarouselNext className="-right-12 h-30 w-8" />
    </Carousel>
  );
}
