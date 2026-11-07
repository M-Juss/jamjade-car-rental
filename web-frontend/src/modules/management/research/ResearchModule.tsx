"use client";

import { useState } from "react";
import { Info, RefreshCw } from "lucide-react";
import { ManagementPageHeading } from "@/modules/management/shell/components/ManagementPageHeading";
import { Button } from "@/components/ui/button";
import { MetadataList } from "@/components/common/data-display/MetadataList";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { FormDialogContent, FormDialogFooter, FormDialogHeader } from "@/components/common/forms/FormDialogLayout";
import { NativeRecordings } from "./NativeRecordings";
import exerciseCatalog from "./rc-exercises-v2.json";

export function ResearchModule() {
  const [revision, setRevision] = useState(0);
  const [guideOpen, setGuideOpen] = useState(false);
  return <section className="space-y-5 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <ManagementPageHeading title="RC Research" description="Review recordings, sensor signals and reference previews." />
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="outline" size="icon" className="size-11" aria-label="Refresh recordings" onClick={() => setRevision(value => value + 1)}>
          <RefreshCw className="size-4" aria-hidden="true" />
        </Button>
        <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="size-11" aria-label="Open abbreviation guide">
              <Info className="size-4" aria-hidden="true" />
            </Button>
          </DialogTrigger>
          <FormDialogContent>
            <FormDialogHeader title="Abbreviation guide" icon={Info} onClose={() => setGuideOpen(false)} closeLabel="Close abbreviation guide" />
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5 text-sm sm:px-6">
              <div className="space-y-3"><p className="font-semibold">S02-FSS-R038</p><MetadataList items={[{ label: 'Session', value: '02' }, { label: 'Exercise', value: 'Forward Start-Stop' }, { label: 'Recording', value: '038' }]} /></div>
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {exerciseCatalog.protocols.map(protocol => (
                  <div key={protocol.code} className="flex min-w-0 items-baseline gap-3">
                    <dt className="shrink-0 font-semibold">{protocol.code}</dt>
                    <dd className="min-w-0 text-muted-foreground">{protocol.label}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <FormDialogFooter>
              <Button type="button" variant="outline" onClick={() => setGuideOpen(false)}>Close</Button>
            </FormDialogFooter>
          </FormDialogContent>
        </Dialog>
      </div>
    </header>
    <NativeRecordings revision={revision} />
  </section>;
}
