"use client";

import { useEffect } from "react";
import { bindStandaloneViewportFix } from "@/lib/mobile-viewport";

export function ViewportFix() {
  useEffect(() => bindStandaloneViewportFix(), []);
  return null;
}
