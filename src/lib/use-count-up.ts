import { useEffect, useRef, useState } from "react";

/**
 * Animates toward `target` with ease-out whenever it changes, so stats
 * "count up" like the reference UI. Collapses to instant values under
 * prefers-reduced-motion. Returns the display value and whether the
 * animation is still running.
 */
export function useCountUp(target: number, durationMs = 900): { value: number; animating: boolean } {
  const [display, setDisplay] = useState(target);
  const [animating, setAnimating] = useState(false);
  const fromRef = useRef(target);
  const rafRef = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    fromRef.current = target;
    if (reduce || from === target) {
      setDisplay(target);
      setAnimating(false);
      return;
    }
    const start = performance.now();
    setAnimating(true);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setAnimating(false);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, durationMs]);

  return { value: display, animating };
}
