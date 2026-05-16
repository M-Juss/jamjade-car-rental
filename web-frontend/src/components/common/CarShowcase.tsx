import { Cog, Fuel, Armchair, Weight } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { cars } from "@/lib/mock_data";

export default function CarShowcase() {
  return (
    <Carousel
      opts={{
        align: "start",
        loop: true,
      }}
      className="w-full"
    >
      <CarouselContent>
        {cars.map((car) => (
          <CarouselItem
            key={car.name}
            className="basis-full sm:basis-1/2 lg:basis-1/4 gap-5"
          >
            <div className="w-full h-fit max-w-sm rounded-2xl my-2  shadow-md overflow-hidden bg-white">
              <img
                src={car.image}
                alt={car.name}
                className="w-full h-60 object-cover"
              />

              <div className="p-4 flex flex-col space-y-2">
                <div className="flex justify-between mb-3">
                  <h2 className="text-lg font-semibold">{car.name}</h2>
                  <p className="text-base font-bold text-blue-600">
                    ₱{car.price.toLocaleString()}{" "}
                    <span className="text-gray-400 text-xs">/ Day</span>
                  </p>
                </div>

                <div className=" grid grid-cols-2 gap-2">
                  <p className="text-sm text-gray-500 flex gap-2 items-center ">
                    <Armchair size={23} className="text-gray-600" />
                    {car.seats} seater{" "}
                  </p>
                  <p className="text-sm text-gray-500 flex gap-2 items-center">
                    <Weight size={23} className="text-gray-600" />
                    {car.gvm} kg
                  </p>
                  <p className="text-sm text-gray-500 flex gap-2 items-center">
                    <Cog size={23} className="text-gray-600" />
                    {car.transmission}
                  </p>
                  <p className="text-sm text-gray-500 flex gap-2 items-center">
                    <Fuel size={23} className="text-gray-600" />
                    {car.fuel}
                  </p>
                </div>
              </div>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="-left-12 h-30 w-8"  />
      <CarouselNext className="-right-12 h-30 w-8" />
    </Carousel>
  );
}
