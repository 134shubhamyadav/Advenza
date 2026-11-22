"use client";

import React from "react";
import { VandeBharatProgressBar } from "./VandeBharatProgressBar";
import { HighwayProgressBar } from "./HighwayProgressBar";
import { BusProgressBar } from "./BusProgressBar";
import { FlightProgressBar } from "./FlightProgressBar";
import { FerryProgressBar } from "./FerryProgressBar";

export interface ModeSceneRendererProps {
  travelMode?: string;
  progress: number; // 0 to 100
  label?: string;
  origin?: string;
  destination?: string;
  showMeta?: boolean;
  showBar?: boolean;
  className?: string;
}

export function ModeSceneRenderer({
  travelMode = "Train",
  progress,
  label,
  origin,
  destination,
  showMeta = true,
  showBar = true,
  className = "",
}: ModeSceneRendererProps) {
  const mode = (travelMode || "train").toLowerCase();

  if (mode.includes("flight") || mode.includes("plane") || mode.includes("air")) {
    return (
      <FlightProgressBar
        progress={progress}
        label={label}
        origin={origin}
        destination={destination}
        showMeta={showMeta}
        showBar={showBar}
        className={className}
      />
    );
  }

  if (mode.includes("bus") || mode.includes("coach")) {
    return (
      <BusProgressBar
        progress={progress}
        label={label}
        origin={origin}
        destination={destination}
        showMeta={showMeta}
        showBar={showBar}
        className={className}
      />
    );
  }

  if (mode.includes("car") || mode.includes("drive") || mode.includes("taxi")) {
    return (
      <HighwayProgressBar
        progress={progress}
        label={label}
        origin={origin}
        destination={destination}
        isBus={false}
        showMeta={showMeta}
        showBar={showBar}
        className={className}
      />
    );
  }

  if (mode.includes("ferry") || mode.includes("ship") || mode.includes("boat")) {
    return (
      <FerryProgressBar
        progress={progress}
        label={label}
        origin={origin}
        destination={destination}
        showMeta={showMeta}
        showBar={showBar}
        className={className}
      />
    );
  }

  // Default to Vande Bharat Train renderer
  return (
    <VandeBharatProgressBar
      progress={progress}
      label={label}
      origin={origin}
      destination={destination}
      showMeta={showMeta}
      showBar={showBar}
      className={className}
    />
  );
}
