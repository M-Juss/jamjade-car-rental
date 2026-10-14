"use client";

import { useDownloadApp } from "@/modules/marketing/DownloadAppProvider";
import { Button } from "@/components/ui/button";

export default function RentNowButton() {
  const { openDownloadApp } = useDownloadApp();

  return (
    <Button
      type="button"
      onClick={openDownloadApp}
      className="min-h-12 min-w-32 cursor-pointer px-6 text-sm font-semibold hover:bg-primary-hover"
    >
      Rent Now
    </Button>
  );
}
