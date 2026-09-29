import { useEffect, useRef } from "react";
import { createVortex, type VortexHandle } from "@/lib/vortex";

/**
 * Fixed, pointer-transparent WebGL canvas that hosts the live vortex
 * background. Purely decorative: hidden from a11y trees, ignored by
 * hit-testing, and safely inert if WebGL is unavailable.
 */
export function VortexBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let handle: VortexHandle | null = null;
    try {
      handle = createVortex(canvas, { speed: 0.9 });
    } catch (err) {
      console.warn("VortexBackground: engine failed to start", err);
    }
    return () => handle?.dispose();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="bg-vortex"
      aria-hidden="true"
      // Decorative canvas: keep it out of hit-testing so the dashboard
      // above stays fully interactive.
      style={{ pointerEvents: "none" }}
    />
  );
}
