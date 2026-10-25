"use client";

import { useRef } from "react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, XAxis, YAxis, type MouseHandlerDataParam } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { seconds, type SignalPoint } from "../recording-analysis";

const axes = [
  { key: "x", color: "var(--primary)", dash: undefined },
  { key: "y", color: "var(--success)", dash: "6 3" },
  { key: "z", color: "var(--warning)", dash: "2 3" },
] as const;
const config = Object.fromEntries(axes.map((axis) => [axis.key, { label: `Phone ${axis.key.toUpperCase()}`, color: axis.color }]));

export function SignalTimeline({ title, unit, points, domain, selection, observed, cursor, onCursor, onSelection, syncId }: {
  title: string; unit: string; points: SignalPoint[]; domain: [number, number];
  selection: [number, number]; observed: [number, number]; cursor: number;
  onCursor: (time: number) => void; onSelection: (range: [number, number]) => void; syncId: string;
}) {
  const dragStart = useRef<number | null>(null);
  const timeFromEvent = (event: MouseHandlerDataParam) => {
    const time = Number(event.activeLabel);
    return event.activeLabel !== undefined && event.activeLabel !== null && Number.isFinite(time) ? Math.max(domain[0], Math.min(domain[1], time)) : null;
  };
  return <div className="min-w-0">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{title} <span className="font-normal text-muted-foreground">({unit})</span></h3>
      <div className="flex gap-3 text-xs text-muted-foreground" aria-label="Phone axes">{axes.map((axis) => <span key={axis.key} className="flex items-center gap-1.5"><svg width="16" height="6" aria-hidden="true"><line x1="0" x2="16" y1="3" y2="3" stroke={axis.color} strokeWidth="2" strokeDasharray={axis.dash} /></svg>{axis.key.toUpperCase()}</span>)}</div>
    </div>
    <ChartContainer config={config} className="h-48 w-full aspect-auto sm:h-52" aria-label={`${title}. Drag to inspect an interval, or use the interval controls below.`}>
      <LineChart data={points} syncId={syncId} syncMethod="value" margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
        onClick={(event) => { const time = timeFromEvent(event); if (time !== null) onCursor(time); }}
        onMouseDown={(event) => { dragStart.current = timeFromEvent(event); }}
        onMouseUp={(event) => {
          const end = timeFromEvent(event); const start = dragStart.current; dragStart.current = null;
          if (start !== null && end !== null && Math.abs(end - start) >= 1) onSelection([Math.min(start, end), Math.max(start, end)]);
        }} onMouseLeave={() => { dragStart.current = null; }}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="time" type="number" domain={domain} allowDataOverflow tickFormatter={(time: number) => `${(time / 1000).toFixed(1)}s`} tickLine={false} axisLine={false} minTickGap={28} />
        <YAxis tickLine={false} axisLine={false} width={62} tickFormatter={(value: number) => Number(value.toFixed(2)).toString()} domain={[(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)]} />
        <ReferenceArea x1={observed[0]} x2={observed[1]} fill="var(--primary)" fillOpacity={0.07} ifOverflow="hidden" />
        <ReferenceArea x1={selection[0]} x2={selection[1]} fillOpacity={0} stroke="var(--primary)" strokeOpacity={0.35} ifOverflow="hidden" />
        <ReferenceLine y={0} stroke="var(--border)" />
        <ReferenceLine x={cursor} stroke="var(--foreground)" strokeDasharray="4 4" />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(label) => seconds(Number(label))} />} />
        {axes.map((axis) => <Line key={axis.key} type="linear" dataKey={axis.key} stroke={`var(--color-${axis.key})`} strokeWidth={1.5} strokeDasharray={axis.dash} dot={false} activeDot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />)}
      </LineChart>
    </ChartContainer>
  </div>;
}
