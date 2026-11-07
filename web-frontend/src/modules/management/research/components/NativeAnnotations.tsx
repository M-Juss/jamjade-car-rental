"use client";

import { useEffect, useState } from "react";
import { AnnotationForm } from "@/forms/research/AnnotationForm";
import { getAnnotations, type AnnotationRevision } from "@/services/research/annotations.service";
import type { NativeInspection } from "@/services/research/native-types";
import { formatReturnDateTime } from "@/services/booking/return-time";
import { humanize } from "../recording-analysis";
import { ResearchState } from "./ResearchState";
import { MetadataList } from "@/components/common/data-display/MetadataList";

export function NativeAnnotations({ inspection, onState }: { inspection: NativeInspection; onState: (state: AnnotationRevision["state"]) => void }) {
  const [saved, setSaved] = useState<AnnotationRevision | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    getAnnotations(inspection.recording.id, c.signal).then(data => { if (!c.signal.aborted) { setSaved(data); onState(data?.state ?? "unlabeled"); setError(null); } })
      .catch(cause => { if (!c.signal.aborted) setError(cause); })
      .finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [inspection.recording.id, revision, onState]);
  const reload = () => { setLoading(true); setRevision(v => v + 1); };
  if (loading || error) return <ResearchState loading={loading} error={error} onRetry={reload} />;
  return <div className="space-y-4">
    {saved && <MetadataList className="sm:grid-cols-3" items={[{ label: 'Revision', value: saved.revision }, { label: 'State', value: humanize(saved.state) }, { label: 'Saved', value: formatReturnDateTime(saved.created_at) }]} />}
    <AnnotationForm key={`${revision}:${saved?.id ?? "new"}`} record={inspection.recording} origin={inspection.manifest.started_elapsed_ns} saved={saved}
      protocolCode={inspection.review.collection?.protocol_code}
      onSaved={value => { setSaved(value); onState(value.state); }} onReload={reload} />

  </div>;
}
