"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// ─── Threshold helpers ────────────────────────────────────────────────────────

type GaugeTier = "excellent" | "good" | "poor";

function getTier(score: number): GaugeTier {
  if (score >= 90) return "excellent";
  if (score >= 65) return "good";
  return "poor";
}

const TIER_CONFIG = {
  excellent: {
    activeColor: "#10b981",   // Emerald-500
    trackColor:  "#052e16",   // deep dark emerald
    statusText:  "Excellent",
    badgeClass:  "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
  },
  good: {
    activeColor: "#f59e0b",   // Amber-500
    trackColor:  "#2d1a00",   // deep dark amber
    statusText:  "Good",
    badgeClass:  "bg-amber-500/15 text-amber-400 border border-amber-500/25",
  },
  poor: {
    activeColor: "#ef4444",   // Red-500
    trackColor:  "#2d0a0a",   // deep dark red
    statusText:  "Critical",
    badgeClass:  "bg-rose-500/15 text-rose-400 border border-rose-500/25",
  },
} as const;

// ─── Geometry constants ───────────────────────────────────────────────────────

const CX = 100;
const CY = 100;
const R  = 78;           // arc radius (centre of notches)
const NOTCH_COUNT = 52;
const NOTCH_WIDTH_DEG = 4.2;   // angular width of each notch (degrees)
const GAP_DEG = 1.6;           // angular gap between notches
const NOTCH_LENGTH = 14;       // radial length of each notch rect
const HALF_W = (NOTCH_WIDTH_DEG / 2) * (Math.PI / 180) * R; // half-chord width

// Gauge sweep: 220° arc, centred at the bottom (starts bottom-left, ends bottom-right)
const START_DEG = 220; // clockwise from 3-o'clock
const SWEEP_DEG = 220; // total sweep of the gauge

function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

// Returns the SVG path for a single rounded-cap notch at a given angle
function buildNotchPath(angleDeg: number): string {
  const a = degToRad(angleDeg);
  const rOuter = R + NOTCH_LENGTH / 2;
  const rInner = R - NOTCH_LENGTH / 2;

  const cos = Math.cos(a);
  const sin = Math.sin(a);

  // Perpendicular direction for the short axis
  const px = -sin;
  const py =  cos;

  const hw = HALF_W * 0.85; // slight squeeze for gaps

  // Four corners of the notch (a thin rounded rectangle)
  const o1x = CX + rOuter * cos + hw * px;
  const o1y = CY + rOuter * sin + hw * py;
  const o2x = CX + rOuter * cos - hw * px;
  const o2y = CY + rOuter * sin - hw * py;
  const i1x = CX + rInner * cos + hw * px;
  const i1y = CY + rInner * sin + hw * py;
  const i2x = CX + rInner * cos - hw * px;
  const i2y = CY + rInner * sin - hw * py;

  // Round caps: radius = hw
  const cap = hw.toFixed(3);

  return (
    `M ${o1x.toFixed(3)} ${o1y.toFixed(3)} ` +
    `L ${o2x.toFixed(3)} ${o2y.toFixed(3)} ` +
    `Q ${(CX + rOuter * cos).toFixed(3)} ${(CY + rOuter * sin).toFixed(3)} ` +
      `${o2x.toFixed(3)} ${o2y.toFixed(3)} ` +  // intentional — browser rounds cap
    `L ${i2x.toFixed(3)} ${i2y.toFixed(3)} ` +
    `L ${i1x.toFixed(3)} ${i1y.toFixed(3)} Z`
  );
}

// Properly rounded-rect notch using stroke-linecap="round" trick via <line>
function NotchSegment({
  angleDeg,
  active,
  color,
  inactiveColor,
  delay,
}: {
  angleDeg: number;
  active: boolean;
  color: string;
  inactiveColor: string;
  delay: number;
}) {
  const a = degToRad(angleDeg);
  const rOuter = R + NOTCH_LENGTH / 2;
  const rInner = R - NOTCH_LENGTH / 2;

  const x1 = CX + rOuter * Math.cos(a);
  const y1 = CY + rOuter * Math.sin(a);
  const x2 = CX + rInner * Math.cos(a);
  const y2 = CY + rInner * Math.sin(a);

  const strokeW = HALF_W * 1.55;

  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={active ? color : inactiveColor}
      strokeWidth={strokeW}
      strokeLinecap="round"
      style={{
        transition: `stroke ${active ? 0.05 + delay * 0.018 : 0.02}s ease`,
      }}
    />
  );
}

// ─── Animated number counter ──────────────────────────────────────────────────

function useAnimatedNumber(target: number, duration = 1200) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const diff = target - from;
    startRef.current = null;

    const step = (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + diff * ease);
      if (progress < 1) {
        raf.current = requestAnimationFrame(step);
      } else {
        fromRef.current = target;
      }
    };

    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, duration]);

  return display;
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface NotchedRadialGaugeProps {
  /** Score value 0–100 */
  score: number;
  className?: string;
}

export function NotchedRadialGauge({ score, className }: NotchedRadialGaugeProps) {
  const clamped = Math.min(100, Math.max(0, score));
  const tier    = getTier(clamped);
  const cfg     = TIER_CONFIG[tier];

  const animatedScore = useAnimatedNumber(clamped, 1400);

  // Build notch angle list
  const notches: number[] = [];
  const stepDeg = SWEEP_DEG / NOTCH_COUNT;
  for (let i = 0; i < NOTCH_COUNT; i++) {
    // SVG angles: 0° = 3-o'clock, clockwise
    // Our start = 160° (bottom-left) in SVG coords
    // (START_DEG is the "human" angle from 12-o'clock, but we work in standard SVG convention)
    // 220° start in standard math convention where 0°=right, CCW positive
    // We want CW gauge starting from bottom-left: map to SVG (0°=right, CW positive)
    // Start = 160° SVG-CW (i.e. bottom-left)
    const svgStartDeg = 160; // SVG CW convention: 160° ≈ bottom-left
    const angle = svgStartDeg + i * stepDeg;
    notches.push(angle);
  }

  // How many notches are "lit"
  const activeCount = Math.round((clamped / 100) * NOTCH_COUNT);
  const inactiveColor = "#1c2333"; // dark charcoal

  return (
    <div className={cn("flex flex-col items-center justify-center", className)}>
      {/* SVG gauge */}
      <div className="relative w-[220px] h-[220px]">
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full"
          style={{ overflow: "visible" }}
        >
          {notches.map((angleDeg, i) => (
            <NotchSegment
              key={i}
              angleDeg={angleDeg}
              active={i < activeCount}
              color={cfg.activeColor}
              inactiveColor={inactiveColor}
              delay={i}
            />
          ))}
        </svg>

        {/* Centre content — absolutely positioned over SVG */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
          <span
            className="text-4xl font-extrabold leading-none tracking-tight"
            style={{
              color: cfg.activeColor,
              transition: "color 0.6s ease",
            }}
          >
            {animatedScore.toFixed(1)}
          </span>
          <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
            Health Score
          </span>
          <span
            className={cn(
              "mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold",
              cfg.badgeClass
            )}
            style={{ transition: "all 0.6s ease" }}
          >
            {cfg.statusText}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-[10px] text-slate-500 mt-1 max-w-[200px] leading-relaxed text-center">
        Composite health index based on count accuracy, verification coverage,
        and financial variance.
      </p>
    </div>
  );
}
