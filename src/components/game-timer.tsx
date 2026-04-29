"use client";

import { useEffect, useState } from "react";

type Props = {
  startedAt: string;
  durationSeconds: number;
};

export function GameTimer({ startedAt, durationSeconds }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    return Math.max(0, durationSeconds - elapsed);
  });

  useEffect(() => {
    const start = new Date(startedAt).getTime();

    function tick() {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const left = Math.max(0, durationSeconds - elapsed);
      setSecondsLeft(left);
    }

    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [startedAt, durationSeconds]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isLow = secondsLeft <= 30;
  const isCritical = secondsLeft <= 10;

  return (
    <div className={`font-mono text-3xl font-bold tabular-nums transition-colors duration-300 ${isCritical ? "text-red-400 animate-pulse" : isLow ? "text-amber-400" : "text-white"}`}>
      {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </div>
  );
}
