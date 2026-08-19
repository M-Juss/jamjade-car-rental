"use client";

import { useDownloadApp } from "@/modules/marketing/DownloadAppProvider";

export default function RentNowButton() {
  const { openDownloadApp } = useDownloadApp();

  return (
    <button
      type="button"
      onClick={openDownloadApp}
      className="min-w-32 min-h-11 cursor-pointer rounded-md bg-white px-5 py-3 text-center text-sm font-semibold text-foreground shadow-lg shadow-black/20 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      Rent Now
    </button>
  );
}
