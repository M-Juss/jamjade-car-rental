import Image from "next/image";
import { X } from "lucide-react";

type VehicleImageGalleryProps = {
  images: string[];
  alt: string;
  className?: string;
  onRemoveImage?: (index: number) => void;
};

export function VehicleImageGallery({ images, alt, className = "", onRemoveImage }: VehicleImageGalleryProps) {
  const visibleImages = images.slice(0, 5);
  const remainingCount = Math.max(0, images.length - 5);
  const [primaryImage, ...thumbnailImages] = visibleImages;
  const removeButtonClass =
    "absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-foreground shadow-md transition-colors hover:bg-rose-50 hover:text-rose-500";

  if (!primaryImage) {
    return (
      <div className={`h-64 rounded-2xl border border-border bg-background ${className}`} />
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="relative h-64 overflow-hidden rounded-2xl border border-border bg-background md:h-80">
        <Image
          src={primaryImage}
          alt={alt}
          fill
          sizes="(min-width: 768px) 80vw, 100vw"
          unoptimized
          className="object-cover"
        />
        {onRemoveImage && (
          <button
            type="button"
            aria-label={`Remove ${alt} image 1`}
            onClick={() => onRemoveImage(0)}
            className={removeButtonClass}
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        )}
      </div>

      {thumbnailImages.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {thumbnailImages.map((image, index) => {
            const showMoreOverlay = remainingCount > 0 && index === thumbnailImages.length - 1;

            return (
              <div
                key={`${image}-${index}`}
                className="relative h-20 overflow-hidden rounded-xl border border-border bg-background md:h-24"
              >
                <Image
                  src={image}
                  alt={`${alt} ${index + 2}`}
                  fill
                  sizes="(min-width: 768px) 20vw, 25vw"
                  unoptimized
                  className="h-full w-full object-cover"
                />
                {showMoreOverlay && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#0B1220]/58 text-xl font-black text-white">
                    +{remainingCount}
                  </div>
                )}
                {onRemoveImage && (
                  <button
                    type="button"
                    aria-label={`Remove ${alt} image ${index + 2}`}
                    onClick={() => onRemoveImage(index + 1)}
                    className={removeButtonClass}
                  >
                    <X size={15} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
