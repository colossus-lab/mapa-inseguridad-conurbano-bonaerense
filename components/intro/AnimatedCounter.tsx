"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

type Props = {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  startDelay?: number;
  className?: string;
};

export default function AnimatedCounter({
  value,
  duration = 1400,
  format = (n) => Math.round(n).toLocaleString("es-AR"),
  startDelay = 0,
  className = "",
}: Props) {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
  }, []);

  const mv = useMotionValue(reduced ? value : 0);
  const spring = useSpring(mv, { stiffness: 80, damping: 20, duration: duration / 1000 });
  const display = useTransform(spring, (v) => format(v));

  useEffect(() => {
    if (reduced) { mv.set(value); return; }
    const id = setTimeout(() => mv.set(value), startDelay);
    return () => clearTimeout(id);
  }, [value, mv, startDelay, reduced]);

  return <motion.span className={className}>{display}</motion.span>;
}
