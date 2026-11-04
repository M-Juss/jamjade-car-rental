"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, XAxis, YAxis, type MouseHandlerDataParam } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { seconds, type SignalPoint } from "../recording-analysis";

const axes = [
  { key: "x", color: "var(--primary)", dash: undefined },
  { key: "y", color: "var(--success)", dash: "6 3" },
  { key: "z", color: "var(--warning)", dash: "2 3" },
] as const;
const phoneLabels = { x: "X", y: "Y", z: "Z" };

export function SignalTimeline({ title, unit, points, domain, selection, observed, cursor, onCursor, onSelection, syncId, includeZero = true, axisLabels = phoneLabels, frameLabel = "Phone", headingLevel = "h3", comparison, initialAxes = ["x", "y", "z"] }: {
  title: string; unit: string; points: SignalPoint[]; domain: [number, number];
  selection: [number, number]; observed?: [number, number]; cursor: number;
  onCursor: (time: number) => void; onSelection: (range: [number, number]) => void; syncId: string;
  includeZero?: boolean;
  axisLabels?: Record<"x" | "y" | "z", string>; frameLabel?: string;
  headingLevel?: "h3" | "h4" | "h5";
  comparison?: { points: SignalPoint[]; label: string };
  initialAxes?: ("x" | "y" | "z")[];
}) {
  const dragStart = useRef<number | null>(null);
  const [visible, setVisible] = useState({ x: initialAxes.includes("x") || initialAxes.length === 0, y: initialAxes.includes("y"), z: initialAxes.includes("z") });
  const config = Object.fromEntries(axes.flatMap(axis => [
    [axis.key, { label: `${comparison ? "Before · " : ""}${frameLabel} ${axisLabels[axis.key]}`, color: axis.color }],
    ...(comparison ? [[`after_${axis.key}`, { label: `${comparison.label} · ${frameLabel} ${axisLabels[axis.key]}`, color: axis.color }]] : []),
  ]));
  const chartPoints = useMemo(() => {
    if (!comparison) return points;
    const byTime = new Map(comparison.points.map(point => [point.time, point]));
    return points.map(point => ({ ...point, after_x: byTime.get(point.time)?.x ?? null,
      after_y: byTime.get(point.time)?.y ?? null, after_z: byTime.get(point.time)?.z ?? null }));
  }, [points, comparison]);
  const Heading = headingLevel;
  const timeFromEvent = (event: MouseHandlerDataParam) => {
    const time = Number(event.activeLabel);
    return event.activeLabel !== undefined && event.activeLabel !== null && Number.isFinite(time) ? Math.max(domain[0], Math.min(domain[1], time)) : null;
  };
  return <div className="min-w-0">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><Heading className="text-sm font-semibold">{title} <span className="font-normal text-muted-foreground">({unit})</span></Heading>
      <div className="flex flex-wrap gap-1 text-xs text-muted-foreground" aria-label={`${frameLabel} axes`}>{axes.map((axis) => <Button key={axis.key} size="sm" variant="ghost" className={`gap-1.5 px-2 text-xs ${visible[axis.key] ? "" : "opacity-40"}`}
        aria-label={`${title}: show ${axisLabels[axis.key]} axis`} aria-pressed={visible[axis.key]}
        disabled={visible[axis.key] && Object.values(visible).filter(Boolean).length === 1}
        onClick={() => setVisible(values => ({ ...values, [axis.key]: !values[axis.key] }))}><svg width="16" height="6" aria-hidden="true"><line x1="0" x2="16" y1="3" y2="3" stroke={axis.color} strokeWidth="2" strokeDasharray={axis.dash} /></svg>{axisLabels[axis.key]}</Button>)}</div>
    </div>
    {comparison && <p className="mb-2 text-xs text-muted-foreground">Before: dashed · {comparison.label}: solid</p>}
    <ChartContainer config={config} className="h-48 w-full aspect-auto sm:h-52" aria-label={`${title}. Use the shared interval controls or drag to inspect an interval.`}>
      <LineChart data={chartPoints} syncId={syncId} syncMethod="value" margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
        onClick={(event) => { const time = timeFromEvent(event); if (time !== null) onCursor(time); }}
        onMouseDown={(event) => { dragStart.current = timeFromEvent(event); }}
        onMouseUp={(event) => {
          const end = timeFromEvent(event); const start = dragStart.current; dragStart.current = null;
          if (start !== null && end !== null && Math.abs(end - start) >= 1) onSelection([Math.min(start, end), Math.max(start, end)]);
        }} onMouseLeave={() => { dragStart.current = null; }}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="time" type="number" domain={domain} allowDataOverflow tickFormatter={(time: number) => `${(time / 1000).toFixed(1)}s`} tickLine={false} axisLine={false} minTickGap={28} />
        <YAxis tickLine={false} axisLine={false} width={62} tickFormatter={(value: number) => Number(value.toPrecision(3)).toString()} domain={includeZero ? [(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)] : ["auto", "auto"]} />
        {observed && <ReferenceArea x1={observed[0]} x2={observed[1]} fill="var(--primary)" fillOpacity={0.07} ifOverflow="hidden" />}
        <ReferenceArea x1={selection[0]} x2={selection[1]} fillOpacity={0} stroke="var(--primary)" strokeOpacity={0.35} ifOverflow="hidden" />
        <ReferenceLine y={0} stroke="var(--border)" />
        <ReferenceLine x={cursor} stroke="var(--foreground)" strokeDasharray="4 4" />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(_label, payload) => {
          const time: unknown = payload[0]?.payload?.time;
          return typeof time === "number" && Number.isFinite(time) ? seconds(time) : "Time unavailable";
        }} />} />
        {axes.filter(axis => visible[axis.key]).map((axis) => <Line key={axis.key} type="linear" dataKey={axis.key} stroke={`var(--color-${axis.key})`} strokeWidth={1.5} strokeOpacity={comparison ? 0.45 : 1} strokeDasharray={comparison ? "5 4" : axis.dash} dot={false} activeDot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />)}
        {comparison && axes.filter(axis => visible[axis.key]).map(axis => <Line key={`after_${axis.key}`} type="linear" dataKey={`after_${axis.key}`} stroke={`var(--color-${axis.key})`} strokeWidth={2} dot={false} activeDot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />)}
      </LineChart>
    </ChartContainer>
  </div>;
}
