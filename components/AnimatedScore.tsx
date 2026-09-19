"use client";

import { useEffect } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { selectReducedMotion } from "@/store/gameStore";
import { useGameStore } from "@/store/useGameStore";

const compactScore = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function formatScore(value: number) {
  return value >= 1_000_000 ? compactScore.format(value) : Math.round(value).toLocaleString("en-US");
}

export function AnimatedScore({ value, fromZero = false, duration = 0.22, testId = "score-value" }: {
  value: number;
  fromZero?: boolean;
  duration?: number;
  testId?: string;
}) {
  const current = useMotionValue(fromZero ? 0 : value);
  const text = useTransform(current, formatScore);
  const reducedMotion = useGameStore(selectReducedMotion);

  useEffect(() => {
    if (value === 0 || reducedMotion) {
      current.set(value);
      return;
    }
    const animation = animate(current, value, { duration, ease: "easeOut" });
    return () => animation.stop();
  }, [current, duration, value, reducedMotion]);

  return (
    <span data-testid={testId} data-value={value}>
      <motion.span aria-hidden="true">{text}</motion.span>
      <span className="sr-only">{value.toLocaleString("en-US")} points</span>
    </span>
  );
}