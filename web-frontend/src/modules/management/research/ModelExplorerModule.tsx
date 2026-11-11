"use client";

import { useState } from "react";
import { TrafficCone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ManagementPageHeading } from "@/modules/management/shell/components/ManagementPageHeading";
import type { Maneuver } from "@/services/research/maneuver-comparison.service";
import { ManeuverComparisonPanel } from "./components/ManeuverComparisonPanel";

const courseVideos: Partial<Record<Maneuver, Record<string, string>>> = {
  cornering: { left: "left-turn.mp4", right: "right-turn.mp4" },
  swerving: { left: "swerving-left.mp4", right: "swerving-right.mp4" },
  acceleration: { forward: "forward.mp4", reverse: "reverse.mp4" },
  braking: { forward: "braking.mp4", reverse: "braking.mp4" },
};

export function ModelExplorerModule() {
  const [maneuver, setManeuver] = useState<Maneuver>("cornering");
  const [direction, setDirection] = useState("left");
  const video = courseVideos[maneuver]?.[direction];

  return <section className="space-y-5 p-4 sm:p-6 lg:p-8">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <ManagementPageHeading title="Model Explorer" description="Compare measured results from reviewed driving recordings." />
      <Dialog>
        <DialogTrigger asChild>
          <Button type="button" className="self-start"><TrafficCone aria-hidden="true" />Driving course</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Driving course</DialogTitle></DialogHeader>
          {video ? <video key={video} className="max-h-[65dvh] w-full rounded-lg" autoPlay loop muted playsInline controls aria-label="Selected driving course">
            <source src={`/research/driving-courses/${video}`} type="video/mp4" />
            Your browser does not support video playback.
          </video> : <p className="text-muted-foreground">No course video available for this selection.</p>}
        </DialogContent>
      </Dialog>
    </div>
    <ManeuverComparisonPanel maneuver={maneuver} direction={direction} onManeuverChange={value => {
      setManeuver(value);
      setDirection(value === "cornering" || value === "swerving" ? "left" : "forward");
    }} onDirectionChange={setDirection} />
  </section>;
}
