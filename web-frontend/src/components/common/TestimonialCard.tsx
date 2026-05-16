import { Quote, Star } from "lucide-react";
import Image from "next/image";

type TestimonialCardProps = {
  fullName: string;
  description: string;
  profile: string;
  stars: number;
};
export default function TestimonialCard({
  fullName,
  description,
  profile,
  stars,
}: TestimonialCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 flex flex-col h-full">
      <Quote className="text-[#346EF6]" fill="#346EF6" size={30} />
      <p className="text-sm text-gray-600 mt-4 flex-1">{description}</p>
      <div className="flex space-x-3 items-center mt-4 pt-2">
        <Image
          src={profile}
          alt={fullName}
          width={40}
          height={40}
          className="w-10 h-10 rounded-full object-cover"
        />
        <div className="flex flex-col">
          <p className="text-sm font-semibold">{fullName}</p>
          <div className="flex items-center">
            {Array.from({ length: stars }).map((_, index) => (
              <Star
                key={`${fullName}-${index}`}
                size={14}
                className="text-[#346EF6]"
                fill="#346EF6"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
