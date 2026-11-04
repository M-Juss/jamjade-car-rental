"use client";

import { useId } from "react";
import type { ReferenceRange } from "../forward-reference";
import { seconds } from "../recording-analysis";

export function SignalSelectionControls({ bounds, selection, onSelection }: {
  bounds: ReferenceRange; selection: ReferenceRange; onSelection: (range: ReferenceRange) => void;
}) {
  const id = useId();
  return <div className="grid gap-3 sm:grid-cols-2">
    {(["Start", "End"] as const).map((label, index) => <div key={label}>
      <label htmlFor={`${id}-${label}`} className="flex justify-between gap-3 text-xs"><span>{label}</span><span className="tabular-nums">{seconds(selection[index])}</span></label>
      <input id={`${id}-${label}`} type="range" className="h-11 w-full accent-primary" min={bounds[0]} max={bounds[1]} step={1} value={selection[index]}
        onChange={event => { const v = Number(event.target.value); onSelection(index === 0 ? [Math.min(v, selection[1]), selection[1]] : [selection[0], Math.max(v, selection[0])]); }} />
    </div>)}
  </div>;
}
