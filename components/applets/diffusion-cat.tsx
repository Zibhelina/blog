"use client";

import { useEffect, useRef, useState } from "react";
import {
  useAppletTheme,
  usePrefersReducedMotion,
} from "@/components/applets/use-applet-theme";

/* ------------------------------------------------------------------ */
/*  Configuration                                                     */
/* ------------------------------------------------------------------ */

const WORKING_SIZE = 256; // offscreen pixel grid (fast)
const DISPLAY_PX = 360; // max CSS width (canvas scales up smoothly)

const CYCLE_MS = 9_000; // one full forward + reverse cycle
const HOLD_CLEAN = 0.06; // fraction of the cycle spent at t = 0
const HOLD_NOISE = 0.03; // fraction of the cycle spent at t = 1

const IMG_PATH = "/blog/about-the-brain/le-chatton.jpg";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

type Direction = "noising" | "denoising" | "clean" | "noise";

/** Map `performance.now()` to noise level t ∈ [0, 1] + direction. */
function sampleCycle(now: number): { t: number; direction: Direction } {
  const phase = (now % CYCLE_MS) / CYCLE_MS;
  const mid = 0.5;
  const halfNoise = HOLD_NOISE / 2;

  // ── hold at clean ──
  if (phase < HOLD_CLEAN || phase >= 1 - HOLD_CLEAN) {
    return { t: 0, direction: "clean" };
  }

  // ── forward (noising) ──
  if (phase < mid - halfNoise) {
    const p =
      (phase - HOLD_CLEAN) / (mid - halfNoise - HOLD_CLEAN);
    return { t: p, direction: "noising" };
  }

  // ── hold at pure noise ──
  if (phase < mid + halfNoise) {
    return { t: 1, direction: "noise" };
  }

  // ── reverse (denoising) ──
  const p =
    (phase - (mid + halfNoise)) /
    (1 - HOLD_CLEAN - (mid + halfNoise));
  return { t: 1 - p, direction: "denoising" };
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function DiffusionCat() {
  const theme = useAppletTheme();
  const reducedMotion = usePrefersReducedMotion();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  // Buffers allocated once
  const cleanRef = useRef<ImageData | null>(null);
  const workRef = useRef<ImageData | null>(null);
  const frameRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [direction, setDirection] = useState<Direction>("clean");

  /* ---------------------------------------------------------------- */
  /*  1.  Load the cat image & prepare offscreen buffers              */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.src = IMG_PATH;

    img.onload = () => {
      if (cancelled) return;

      // Downscale to working resolution
      const off = document.createElement("canvas");
      off.width = WORKING_SIZE;
      off.height = WORKING_SIZE;
      const ctx = off.getContext("2d")!;
      ctx.drawImage(img, 0, 0, WORKING_SIZE, WORKING_SIZE);

      cleanRef.current = ctx.getImageData(0, 0, WORKING_SIZE, WORKING_SIZE);
      workRef.current = new ImageData(WORKING_SIZE, WORKING_SIZE);

      setReady(true);
    };

    img.onerror = () => {
      if (!cancelled) console.error("DiffusionCat: failed to load cat image");
    };

    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------------------------------------------------------------- */
  /*  2.  Animation loop (skipped when prefers-reduced-motion)        */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (!ready || reducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = WORKING_SIZE;
    canvas.height = WORKING_SIZE;

    const ctx = canvas.getContext("2d")!;

    const animate = (timestamp: number) => {
      const clean = cleanRef.current;
      const work = workRef.current;
      if (!clean || !work) return;

      const { t, direction: dir } = sampleCycle(timestamp);
      setDirection(dir);

      const frame = frameRef.current++;
      const cleanArr = clean.data;
      const workArr = work.data;

      // Precompute blend coefficients
      const invA = 1 - t; // clean weight
      const a = t; // noise weight

      // Fast LCG PRNG, state percolates across the whole frame
      let state = (frame * 0x9e3779b9) | 0;

      for (let i = 0; i < cleanArr.length; i += 4) {
        // ONE LCG step → a single grayscale value applied to R, G, B equally.
        // This is black-and-white TV static, not colored speckle. Use the HIGH
        // bits (the low bits of an LCG are weakly random and show patterns).
        state = Math.imul(state, 1664525) + 1013904223;
        const gray = (state >>> 24) & 0xff;

        workArr[i] = cleanArr[i] * invA + gray * a;
        workArr[i + 1] = cleanArr[i + 1] * invA + gray * a;
        workArr[i + 2] = cleanArr[i + 2] * invA + gray * a;
        workArr[i + 3] = 255;
      }

      ctx.putImageData(work, 0, 0);
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [ready, reducedMotion]);

  /* ---------------------------------------------------------------- */
  /*  3.  Reduced-motion fallback: static clean cat                   */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (!ready || !reducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = WORKING_SIZE;
    canvas.height = WORKING_SIZE;

    const clean = cleanRef.current;
    if (clean) {
      const ctx = canvas.getContext("2d")!;
      ctx.putImageData(clean, 0, 0);
    }

    setDirection("clean");
  }, [ready, reducedMotion]);

  /* ---------------------------------------------------------------- */
  /*  4.  Caption (Portuguese, theme-coloured)                        */
  /* ---------------------------------------------------------------- */
  const caption: string =
    direction === "noising"
      ? "le chatton fat → ruído"
      : direction === "denoising"
        ? "ruído → le chatton fat"
        : direction === "noise"
          ? "ruído puro"
          : "le chatton fat limpo";

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */

  // Transparent placeholder avoids layout shift before the image loads.
  const placeholderStyle: React.CSSProperties = {
    display: "block",
    width: `min(100%, ${DISPLAY_PX}px)`,
    aspectRatio: "1 / 1",
    background: "transparent",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: "transparent",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          ...placeholderStyle,
          imageRendering: "auto",
        }}
      />

      {ready && theme && (
        <span
          style={{
            marginTop: 8,
            fontSize: "0.8rem",
            lineHeight: 1.4,
            color: theme.subtle,
            fontStyle: "italic",
          }}
        >
          {caption}
        </span>
      )}
    </div>
  );
}
