"use client";

import Image from "next/image";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FaGooglePlay, FaApple } from "react-icons/fa";

interface DownloadAppModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DownloadAppModal({
  open,
  onOpenChange,
}: DownloadAppModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 overflow-hidden rounded-3xl border-0 max-w-xs w-full shadow-2xl bg-white gap-0">
        <DialogTitle className="sr-only">Download JamJade App</DialogTitle>
        {/* Header */}
        <div className="flex flex-col items-center pt-9 pb-5 px-8 text-center">
          <Image
            src="/JamJadeLogo-gradient.png"
            alt="JamJade Logo"
            width={82}
            height={82}
            className="object-contain"
          />
          <h2 className="text-lg font-bold text-gray-900 leading-tight mb-1">
            JamJade Car Rental
          </h2>
          <p className="text-xs text-gray-400 leading-relaxed max-w-[210px]">
            Download the app and book your ride in seconds.
          </p>
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-100 mx-6 mb-6" />

        {/* Store Buttons */}
        <div className="px-6 pb-8 flex flex-col gap-3">

          {/* Google Play */}
          <a
            href="#"
            className="flex items-center justify-center gap-3 bg-white rounded-2xl px-5 py-4 shadow-[0_2px_14px_rgba(0,0,0,0.09)] border border-gray-100 hover:shadow-[0_4px_20px_rgba(0,0,0,0.13)] transition-shadow"
          >
            <FaGooglePlay size={28} className="text-[#01875f] shrink-0" />
            <div className="flex flex-col items-center">
              <span className="text-[9px] font-medium uppercase tracking-[0.15em] text-gray-400 leading-none mb-0.5">
                GET IT ON
              </span>
              <span className="text-lg font-semibold text-gray-900 leading-none">
                Google Play
              </span>
            </div>
          </a>

          {/* App Store */}
          <a
            href="#"
            className="flex items-center justify-center gap-3 bg-white rounded-2xl px-5 py-4 shadow-[0_2px_14px_rgba(0,0,0,0.09)] border border-gray-100 hover:shadow-[0_4px_20px_rgba(0,0,0,0.13)] transition-shadow"
          >
            <FaApple size={30} className="text-gray-900 shrink-0" />
            <div className="flex flex-col items-center">
              <span className="text-[9px] font-medium uppercase tracking-[0.15em] text-gray-400 leading-none mb-0.5">
                DOWNLOAD ON THE
              </span>
              <span className="text-lg font-semibold text-gray-900 leading-none">
                App Store
              </span>
            </div>
          </a>

        </div>
      </DialogContent>
    </Dialog>
  );
}
