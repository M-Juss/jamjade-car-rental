"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import { FilterSelect } from "@/components/common/forms/FilterSelect";
import { Button } from "@/components/ui/button";
import { getNativeWindow } from "@/services/research/native-research.service";
import type { NativeChannel, NativeRecording, NativeWindow } from "@/services/research/native-types";
import type { ReferenceRange } from "../forward-reference";
import { seconds } from "../recording-analysis";
import { ResearchState } from "./ResearchState";

/** One bounded original-window loader shared by inspection and reference preparation. */
export function NativeSignalWindow({ record, channels, children }: {
  record: NativeRecording; channels: NativeChannel[];
  children: (windows: NativeWindow[], bounds: ReferenceRange) => ReactNode;
}) {
  const [start, setStart] = useState(0);
  const [windowSize, setWindowSize] = useState(30000);
  const [revision, setRevision] = useState(0);
  const end = Math.min(record.duration_ms, start + windowSize);
  const requestKey = `${record.id}:${channels.join(",")}:${start}:${end}:${revision}`;
  const [result, setResult] = useState<{ key: string; windows: NativeWindow[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setError(null);
      const results = await Promise.allSettled(channels.map(channel => getNativeWindow(record.id, channel, start, end, controller.signal)));
      if (controller.signal.aborted) return;
      const failed = results.find(item => item.status === "rejected");
      if (failed?.status === "rejected") setError(failed.reason);
      else setResult({ key: requestKey, windows: results.flatMap(item => item.status === "fulfilled" ? [item.value] : []) });
      setLoading(false);
    }, 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [record.id, channels, start, end, requestKey]);
  const pending = loading || (!error && result?.key !== requestKey);
  return <div className="space-y-4">
    {(record.duration_ms > 30000 || Boolean(error)) && <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs tabular-nums text-muted-foreground">{seconds(start)}–{seconds(end)} of {seconds(record.duration_ms)}</p>
      <div className="flex flex-wrap gap-2">
        <FilterSelect ariaLabel="Signal window length" className="w-36" value={String(windowSize)} onValueChange={value => { setWindowSize(Number(value)); setStart(0); }}
          options={[{ value: "5000", label: "5 seconds" }, { value: "10000", label: "10 seconds" }, { value: "30000", label: "30 seconds" }]} />
        <Button size="sm" variant="outline" disabled={start <= 0 || pending} onClick={() => setStart(v => Math.max(0, v - windowSize))}>Previous</Button>
        <Button size="sm" variant="outline" disabled={end >= record.duration_ms || pending} onClick={() => setStart(end)}>Next</Button>
      </div>
    </div>}
    {pending || error || !result ? <ResearchState loading={Boolean(pending)} error={error} onRetry={() => setRevision(v => v + 1)} />
      : <Fragment key={requestKey}>{children(result.windows, [start, end])}</Fragment>}
  </div>;
}
