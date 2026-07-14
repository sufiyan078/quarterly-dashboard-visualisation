"use client"

import React, { createContext, useContext, useState, useEffect, useMemo } from "react"
import { motion, animate } from "framer-motion"
import { cn } from "@/lib/utils"

interface PieData {
  label: string;
  value: number;
  color: string;
}

interface PieChartContextType {
  data: PieData[];
  innerRadius: number;
  padAngle: number;
  cornerRadius: number;
  hoveredIndex: number | null;
  setHoveredIndex: (index: number | null) => void;
  total: number;
}

const PieChartContext = createContext<PieChartContextType | null>(null);

export function usePieChart() {
  const context = useContext(PieChartContext);
  if (!context) {
    throw new Error("usePieChart must be used within a PieChart provider");
  }
  return context;
}

interface PieChartProps {
  data: PieData[];
  innerRadius?: number;
  padAngle?: number;
  cornerRadius?: number;
  children: React.ReactNode;
}

export function PieChart({
  data,
  innerRadius = 55,
  padAngle = 0.02,
  cornerRadius = 4,
  children,
}: PieChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const total = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);

  // Separate SVG children (PieSlice, etc.) from HTML overlays (PieCenter)
  const childrenArray = React.Children.toArray(children);
  const svgChildren = childrenArray.filter(
    (child) => React.isValidElement(child) && child.type !== PieCenter
  );
  const htmlChildren = childrenArray.filter(
    (child) => React.isValidElement(child) && child.type === PieCenter
  );

  return (
    <PieChartContext.Provider
      value={{
        data,
        innerRadius,
        padAngle,
        cornerRadius,
        hoveredIndex,
        setHoveredIndex,
        total,
      }}
    >
      <div className="relative w-full h-full flex items-center justify-center">
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full overflow-visible transform -rotate-90"
        >
          {svgChildren}
        </svg>
        {htmlChildren}
      </div>
    </PieChartContext.Provider>
  );
}

interface PieSliceProps {
  index: number;
}

export function PieSlice({ index }: PieSliceProps) {
  const { data, innerRadius, padAngle, cornerRadius, hoveredIndex, setHoveredIndex } = usePieChart();

  const item = data[index];
  if (!item || item.value <= 0) return null;

  const totalVal = useMemo(() => data.reduce((sum, d) => sum + d.value, 0) || 1, [data]);

  // Compute angles
  const { startAngle, endAngle } = useMemo(() => {
    let accumulatedValue = 0;
    for (let i = 0; i < index; i++) {
      accumulatedValue += data[i].value;
    }
    const s = (accumulatedValue / totalVal) * 2 * Math.PI;
    const e = ((accumulatedValue + item.value) / totalVal) * 2 * Math.PI;
    return { startAngle: s, endAngle: e };
  }, [data, index, item.value, totalVal]);

  const isHovered = hoveredIndex === index;
  const bisectorAngle = (startAngle + endAngle) / 2;

  // Calculate translation vectors for hover effect
  const hoverOffset = 8;
  const tx = isHovered ? Math.cos(bisectorAngle) * hoverOffset : 0;
  const ty = isHovered ? Math.sin(bisectorAngle) * hoverOffset : 0;

  // Generate SVG path for the arc segment
  const path = useMemo(() => {
    const cx = 100;
    const cy = 100;
    const rOuter = 90;
    const rInner = innerRadius;

    // Apply padAngle if there is more than 1 item
    const delta = endAngle - startAngle;
    const actualPad = data.length > 1 ? Math.min(padAngle, delta / 2) : 0;
    const sAngle = startAngle + actualPad;
    const eAngle = endAngle - actualPad;

    if (eAngle <= sAngle) return "";

    const largeArcFlag = eAngle - sAngle > Math.PI ? 1 : 0;

    // Standard coordinate mapping (clockwise starting from 3 o'clock)
    const startOuter = {
      x: cx + rOuter * Math.cos(sAngle),
      y: cy + rOuter * Math.sin(sAngle),
    };
    const endOuter = {
      x: cx + rOuter * Math.cos(eAngle),
      y: cy + rOuter * Math.sin(eAngle),
    };
    const startInner = {
      x: cx + rInner * Math.cos(sAngle),
      y: cy + rInner * Math.sin(sAngle),
    };
    const endInner = {
      x: cx + rInner * Math.cos(eAngle),
      y: cy + rInner * Math.sin(eAngle),
    };

    return `
      M ${startOuter.x} ${startOuter.y}
      A ${rOuter} ${rOuter} 0 ${largeArcFlag} 1 ${endOuter.x} ${endOuter.y}
      L ${endInner.x} ${endInner.y}
      A ${rInner} ${rInner} 0 ${largeArcFlag} 0 ${startInner.x} ${startInner.y}
      Z
    `.trim();
  }, [startAngle, endAngle, innerRadius, padAngle, data.length]);

  return (
    <g
      onMouseEnter={() => setHoveredIndex(index)}
      onMouseLeave={() => setHoveredIndex(null)}
      className="cursor-pointer"
    >
      <motion.path
        d={path}
        fill={item.color}
        stroke={item.color}
        strokeWidth={cornerRadius}
        strokeLinejoin="round"
        initial={{ scale: 0, opacity: 0 }}
        animate={{
          scale: 1,
          opacity: 1,
          x: tx,
          y: ty,
          filter: isHovered
            ? `drop-shadow(0px 0px 8px ${item.color}cc) drop-shadow(0px 4px 12px rgba(0,0,0,0.5))`
            : "drop-shadow(0px 1px 3px rgba(0,0,0,0.2))",
        }}
        transition={{
          type: "spring",
          stiffness: 280,
          damping: 22,
          scale: { duration: 0.5, ease: "easeOut", delay: index * 0.08 },
          opacity: { duration: 0.4, delay: index * 0.08 },
        }}
      />
    </g>
  );
}

interface PieCenterProps {
  defaultLabel?: string;
  prefix?: string;
}

export function PieCenter({ defaultLabel = "TOTAL", prefix = "" }: PieCenterProps) {
  const { total } = usePieChart();
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const controls = animate(0, total, {
      duration: 1.2,
      ease: "easeOut",
      onUpdate: (value) => setDisplayValue(value),
    });
    return () => controls.stop();
  }, [total]);

  const formatValue = (val: number) => {
    if (val >= 1_000_000) return `${prefix}${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${prefix}${(val / 1_000).toFixed(1)}K`;
    return `${prefix}${val.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none select-none z-10">
      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest scale-95">
        {defaultLabel}
      </span>
      <span className="font-mono font-bold text-white tracking-tight text-[13px] mt-0.5">
        {formatValue(displayValue)}
      </span>
    </div>
  );
}
