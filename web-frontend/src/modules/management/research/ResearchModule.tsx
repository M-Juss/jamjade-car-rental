"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { ManagementPageHeading } from "@/modules/management/shell/components/ManagementPageHeading";
import { Button } from "@/components/ui/button";
import { NativeRecordings } from "./NativeRecordings";

export function ResearchModule() {
  const [revision, setRevision] = useState(0);
  return <section className="space-y-5 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <ManagementPageHeading title="RC Research" description="Review recordings, sensor signals and reference previews." />
      <Button variant="outline" onClick={() => setRevision(value => value + 1)}><RefreshCw className="size-4" />Refresh</Button>
    </header>
    <NativeRecordings revision={revision} />
  </section>;
}
