import type { VehiclePanelName } from "../types";
import {
  FRONT_VEHICLE_PATH,
  LEFT_VEHICLE_PATH,
  REAR_VEHICLE_PATH,
  RIGHT_VEHICLE_PATH,
} from "./vehicle-artwork-paths";

type VehiclePanelArtworkProps = {
  panel: VehiclePanelName;
};

const FRONT_ARTWORK_SOURCE_BOUNDS = {
  x: 306.5,
  y: 408.5,
  width: 891,
  height: 674,
};

const FRONT_ARTWORK_TARGET_BOUNDS = {
  x: 160,
  y: 50,
  width: 680,
  height: 500,
};

const frontArtworkScale = Math.min(
  FRONT_ARTWORK_TARGET_BOUNDS.width / FRONT_ARTWORK_SOURCE_BOUNDS.width,
  FRONT_ARTWORK_TARGET_BOUNDS.height / FRONT_ARTWORK_SOURCE_BOUNDS.height,
);
const frontArtworkX = FRONT_ARTWORK_TARGET_BOUNDS.x
  + (FRONT_ARTWORK_TARGET_BOUNDS.width - FRONT_ARTWORK_SOURCE_BOUNDS.width * frontArtworkScale) / 2;
const FRONT_ARTWORK_TRANSFORM = [
  `translate(${frontArtworkX} ${FRONT_ARTWORK_TARGET_BOUNDS.y})`,
  `scale(${frontArtworkScale})`,
  `translate(${-FRONT_ARTWORK_SOURCE_BOUNDS.x} ${-FRONT_ARTWORK_SOURCE_BOUNDS.y})`,
].join(" ");

const RIGHT_ARTWORK_SOURCE_BOUNDS = {
  x: 204.5,
  y: 542.5,
  width: 1121,
  height: 393,
};

const RIGHT_ARTWORK_TARGET_BOUNDS = {
  x: 70,
  y: 75,
  width: 860,
  height: 450,
};

const rightArtworkScale = Math.min(
  RIGHT_ARTWORK_TARGET_BOUNDS.width / RIGHT_ARTWORK_SOURCE_BOUNDS.width,
  RIGHT_ARTWORK_TARGET_BOUNDS.height / RIGHT_ARTWORK_SOURCE_BOUNDS.height,
);
const rightArtworkY = RIGHT_ARTWORK_TARGET_BOUNDS.y
  + (RIGHT_ARTWORK_TARGET_BOUNDS.height - RIGHT_ARTWORK_SOURCE_BOUNDS.height * rightArtworkScale) / 2;
const RIGHT_ARTWORK_TRANSFORM = [
  `translate(${RIGHT_ARTWORK_TARGET_BOUNDS.x} ${rightArtworkY})`,
  `scale(${rightArtworkScale})`,
  `translate(${-RIGHT_ARTWORK_SOURCE_BOUNDS.x} ${-RIGHT_ARTWORK_SOURCE_BOUNDS.y})`,
].join(" ");

const LEFT_ARTWORK_SOURCE_BOUNDS = {
  x: 173.5,
  y: 560.5,
  width: 1130,
  height: 393,
};

const LEFT_ARTWORK_TARGET_BOUNDS = {
  x: 70,
  y: 75,
  width: 860,
  height: 450,
};

const leftArtworkScale = Math.min(
  LEFT_ARTWORK_TARGET_BOUNDS.width / LEFT_ARTWORK_SOURCE_BOUNDS.width,
  LEFT_ARTWORK_TARGET_BOUNDS.height / LEFT_ARTWORK_SOURCE_BOUNDS.height,
);
const leftArtworkY = LEFT_ARTWORK_TARGET_BOUNDS.y
  + (LEFT_ARTWORK_TARGET_BOUNDS.height - LEFT_ARTWORK_SOURCE_BOUNDS.height * leftArtworkScale) / 2;
const LEFT_ARTWORK_TRANSFORM = [
  `translate(${LEFT_ARTWORK_TARGET_BOUNDS.x} ${leftArtworkY})`,
  `scale(${leftArtworkScale})`,
  `translate(${-LEFT_ARTWORK_SOURCE_BOUNDS.x} ${-LEFT_ARTWORK_SOURCE_BOUNDS.y})`,
].join(" ");

const REAR_ARTWORK_SOURCE_BOUNDS = {
  x: 273.5,
  y: 388.5,
  width: 942,
  height: 684,
};

const REAR_ARTWORK_TARGET_BOUNDS = {
  x: 160,
  y: 50,
  width: 680,
  height: 500,
};

const rearArtworkScale = Math.min(
  REAR_ARTWORK_TARGET_BOUNDS.width / REAR_ARTWORK_SOURCE_BOUNDS.width,
  REAR_ARTWORK_TARGET_BOUNDS.height / REAR_ARTWORK_SOURCE_BOUNDS.height,
);
const rearArtworkY = REAR_ARTWORK_TARGET_BOUNDS.y
  + (REAR_ARTWORK_TARGET_BOUNDS.height - REAR_ARTWORK_SOURCE_BOUNDS.height * rearArtworkScale) / 2;
const REAR_ARTWORK_TRANSFORM = [
  `translate(${REAR_ARTWORK_TARGET_BOUNDS.x} ${rearArtworkY})`,
  `scale(${rearArtworkScale})`,
  `translate(${-REAR_ARTWORK_SOURCE_BOUNDS.x} ${-REAR_ARTWORK_SOURCE_BOUNDS.y})`,
].join(" ");

function FrontArtwork() {
  return (
    <g transform={FRONT_ARTWORK_TRANSFORM}>
      <path
        d={FRONT_VEHICLE_PATH}
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </g>
  );
}

function RightArtwork() {
  return (
    <g transform={RIGHT_ARTWORK_TRANSFORM}>
      <path
        d={RIGHT_VEHICLE_PATH}
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </g>
  );
}

function LeftArtwork() {
  return (
    <g transform={LEFT_ARTWORK_TRANSFORM}>
      <path
        d={LEFT_VEHICLE_PATH}
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </g>
  );
}

function RearArtwork() {
  return (
    <g transform={REAR_ARTWORK_TRANSFORM}>
      <path
        d={REAR_VEHICLE_PATH}
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </g>
  );
}

export function VehiclePanelArtwork({ panel }: VehiclePanelArtworkProps) {
  return (
    <g aria-hidden="true" className="text-foreground" pointerEvents="none">
      {panel === "front" && <FrontArtwork />}
      {panel === "right" && <RightArtwork />}
      {panel === "rear" && <RearArtwork />}
      {panel === "left" && <LeftArtwork />}
    </g>
  );
}

export function VehiclePanelHitRegion({ panel }: VehiclePanelArtworkProps) {
  const commonProps = {
    "data-vehicle-hit-region": true,
    fill: "transparent",
    pointerEvents: "all" as const,
  };

  if (panel === "front") {
    return <path {...commonProps} d="M170 550 L170 220 Q170 135 240 100 L315 65 Q380 50 500 50 Q620 50 685 65 L760 100 Q830 135 830 220 L830 550 Z" />;
  }

  if (panel === "right") {
    return <path {...commonProps} d="M70 455 L75 285 Q90 230 185 205 L300 165 Q365 145 500 145 Q675 145 790 190 L865 215 Q925 240 930 315 L930 455 Z" />;
  }

  if (panel === "rear") {
    return <path {...commonProps} d="M160 550 L160 230 Q160 140 240 100 L315 65 Q380 50 500 50 Q620 50 685 65 L760 100 Q840 140 840 230 L840 550 Z" />;
  }

  return <path {...commonProps} d="M70 455 L70 315 Q75 240 135 215 L210 190 Q325 145 500 145 Q635 145 700 165 L815 205 Q910 230 925 285 L930 455 Z" />;
}
