import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function BrutalCard({
  children,
  className = "",
  tone = "paper",
  layout
}: {
  children: ReactNode;
  className?: string;
  tone?: "paper" | "red" | "yellow" | "black";
  layout?: boolean | "size" | "position" | "preserve-aspect";
}) {
  const toneClass = tone === "red" ? "brutal-card-red" : tone === "yellow" ? "brutal-card-yellow" : tone === "black" ? "brutal-card-black" : "";

  return (
    <motion.div layout={layout} whileTap={{ scale: 0.985 }} transition={{ type: "spring", stiffness: 520, damping: 24 }} className={`brutal-card ${toneClass} ${className}`}>
      {children}
    </motion.div>
  );
}
