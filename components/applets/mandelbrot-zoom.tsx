"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  useAppletTheme,
  usePrefersReducedMotion,
} from "@/components/applets/use-applet-theme";
import type { AppletTheme } from "@/components/applets/use-applet-theme";

/* ------------------------------------------------------------------ */
/*  Configuration                                                     */
/* ------------------------------------------------------------------ */

const WORKING_SIZE = 300; // offscreen pixel grid the fractal is computed on
const DISPLAY_PX = 420; // max CSS width (canvas scales up smoothly)

const REVEAL_MS = 780; // duration of the de-noising reveal after a view change
const ZOOM_FACTOR = 2.4; // how much each click dives in
const HOME = { cx: -0.5, cy: 0, scale: 1.5 }; // classic full view
const MIN_SCALE = 5e-14; // float64 runs out of detail around here
const BASE_ITER = 140;
const MAX_ITER = 620;
const BAILOUT = 256; // large bailout → smoother continuous coloring

/* ------------------------------------------------------------------ */
/*  i18n                                                              */
/* ------------------------------------------------------------------ */

type Lang = "pt" | "en";

const COPY = {
  pt: {
    hint: "Clique na imagem pra dar zoom. Cada nível precisa renderizar de novo.",
    rendering: "fazendo de-noising deste nível…",
    deeper: (mag: string) => `zoom ${mag} · clique pra descer mais`,
    limit: "você bateu no limite do float64 - o do computador, não o do objeto",
    zoomOut: "− afastar",
    reset: "recomeçar",
  },
  en: {
    hint: "Click the image to zoom. Each level has to render again.",
    rendering: "de-noising this level…",
    deeper: (mag: string) => `zoom ${mag} · click to go deeper`,
    limit: "you hit the float64 limit - the computer's, not the object's",
    zoomOut: "− zoom out",
    reset: "reset",
  },
} as const;

/* ------------------------------------------------------------------ */
/*  Colour helpers                                                    */
/* ------------------------------------------------------------------ */

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const h = hex.trim().replace("#", "");
  if (h.length >= 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return [r, g, b];
    }
  }
  return [128, 128, 128];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Cyclic gradient through the Everforest accents, indexed by smooth iteration. */
function makePalette(theme: AppletTheme) {
  const ring: RGB[] = [
    hexToRgb(theme.green),
    hexToRgb(theme.aqua),
    hexToRgb(theme.yellow),
    hexToRgb(theme.orange),
    hexToRgb(theme.red),
    hexToRgb(theme.purple),
  ];
  const interior: RGB =
    theme.mode === "dark" ? hexToRgb(theme.surface) : [43, 51, 56];
  const n = ring.length;

  return function colour(mu: number): RGB {
    if (!Number.isFinite(mu)) return interior;
    const f = mu * 0.11;
    const pos = (f - Math.floor(f)) * n;
    const i0 = Math.floor(pos) % n;
    const i1 = (i0 + 1) % n;
    const fr = pos - Math.floor(pos);
    const a = ring[i0]!;
    const b = ring[i1]!;
    return [
      lerp(a[0], b[0], fr),
      lerp(a[1], b[1], fr),
      lerp(a[2], b[2], fr),
    ];
  };
}

/* ------------------------------------------------------------------ */
/*  Fractal compute                                                   */
/* ------------------------------------------------------------------ */

type View = { cx: number; cy: number; scale: number };

/** Iteration budget grows as you dive, so deeper levels can resolve detail. */
function iterFor(scale: number): number {
  const extra = Math.max(0, Math.log2(HOME.scale / scale)) * 38;
  return Math.min(MAX_ITER, Math.floor(BASE_ITER + extra));
}

/** Render the Mandelbrot set for `view` into a fresh ImageData (the "clean" frame). */
function computeClean(view: View, theme: AppletTheme): ImageData {
  const N = WORKING_SIZE;
  const out = new ImageData(N, N);
  const data = out.data;
  const colour = makePalette(theme);
  const maxIter = iterFor(view.scale);
  const ln2 = Math.LN2;

  for (let py = 0; py < N; py++) {
    const cy0 = view.cy + (((py + 0.5) / N) * 2 - 1) * view.scale;
    for (let px = 0; px < N; px++) {
      const cx0 = view.cx + (((px + 0.5) / N) * 2 - 1) * view.scale;

      let zx = 0;
      let zy = 0;
      let i = 0;
      let m2 = 0;
      while (i < maxIter) {
        const xt = zx * zx - zy * zy + cx0;
        zy = 2 * zx * zy + cy0;
        zx = xt;
        m2 = zx * zx + zy * zy;
        if (m2 > BAILOUT) break;
        i++;
      }

      const o = (py * N + px) * 4;
      let r: number, g: number, b: number;
      if (i >= maxIter) {
        const c = colour(NaN); // interior
        r = c[0];
        g = c[1];
        b = c[2];
      } else {
        // smooth (continuous) iteration count
        const mu = i + 1 - Math.log(Math.log(Math.sqrt(m2))) / ln2;
        const c = colour(mu);
        r = c[0];
        g = c[1];
        b = c[2];
      }
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Formatting                                                        */
/* ------------------------------------------------------------------ */

function formatMag(scale: number): string {
  const mag = HOME.scale / scale;
  if (mag < 1000) return `${Math.round(mag)}×`;
  if (mag < 1e6) return `${Math.round(mag / 1000)} mil×`;
  return `${mag.toExponential(1)}×`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function MandelbrotZoom({ lang = "pt" }: { lang?: Lang }) {
  const theme = useAppletTheme();
  const reducedMotion = usePrefersReducedMotion();
  const t = COPY[lang];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cleanRef = useRef<ImageData | null>(null);
  const workRef = useRef<ImageData | null>(null);
  const rafRef = useRef(0);
  const frameRef = useRef(0);
  const shouldRevealRef = useRef(true); // reveal on mount + on user-driven view changes

  const [view, setView] = useState<View>({ ...HOME });
  const [revealing, setRevealing] = useState(false);
  const [atLimit, setAtLimit] = useState(false);

  /* ---------------------------------------------------------------- */
  /*  Compute + draw whenever the view (or theme) changes             */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (!theme) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = WORKING_SIZE;
    canvas.height = WORKING_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    cancelAnimationFrame(rafRef.current);

    // Let the "de-noising…" caption paint before the (blocking) compute.
    const handle = requestAnimationFrame(() => {
      const clean = computeClean(view, theme);
      cleanRef.current = clean;
      if (!workRef.current) workRef.current = new ImageData(WORKING_SIZE, WORKING_SIZE);

      const reveal = shouldRevealRef.current && !reducedMotion;
      shouldRevealRef.current = false;

      if (!reveal) {
        ctx.putImageData(clean, 0, 0);
        setRevealing(false);
        return;
      }

      // Reveal the clean frame out of TV static — one de-noising pass.
      setRevealing(true);
      const start = performance.now();
      const cleanArr = clean.data;
      const work = workRef.current!;
      const workArr = work.data;

      const step = (now: number) => {
        const p = Math.min(1, (now - start) / REVEAL_MS);
        const noise = 1 - p; // 1 → 0
        const signal = p;
        let state = (frameRef.current++ * 0x9e3779b9) | 0;
        for (let i = 0; i < cleanArr.length; i += 4) {
          state = Math.imul(state, 1664525) + 1013904223;
          const gray = (state >>> 24) & 0xff;
          workArr[i] = cleanArr[i] * signal + gray * noise;
          workArr[i + 1] = cleanArr[i + 1] * signal + gray * noise;
          workArr[i + 2] = cleanArr[i + 2] * signal + gray * noise;
          workArr[i + 3] = 255;
        }
        ctx.putImageData(work, 0, 0);
        if (p < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          ctx.putImageData(clean, 0, 0);
          setRevealing(false);
        }
      };
      rafRef.current = requestAnimationFrame(step);
    });

    return () => {
      cancelAnimationFrame(handle);
      cancelAnimationFrame(rafRef.current);
    };
  }, [view, theme, reducedMotion]);

  /* ---------------------------------------------------------------- */
  /*  Interaction                                                     */
  /* ---------------------------------------------------------------- */
  const zoomInAt = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const fx = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const fy = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));

      setView((v) => {
        const targetCx = v.cx + (fx * 2 - 1) * v.scale;
        const targetCy = v.cy + (fy * 2 - 1) * v.scale;
        let next = v.scale / ZOOM_FACTOR;
        if (next <= MIN_SCALE) {
          next = MIN_SCALE;
          setAtLimit(true);
        } else {
          setAtLimit(false);
        }
        shouldRevealRef.current = true;
        return { cx: targetCx, cy: targetCy, scale: next };
      });
    },
    []
  );

  const zoomOut = useCallback(() => {
    setView((v) => {
      const next = Math.min(HOME.scale, v.scale * ZOOM_FACTOR);
      setAtLimit(false);
      shouldRevealRef.current = true;
      return { ...v, scale: next };
    });
  }, []);

  const reset = useCallback(() => {
    setAtLimit(false);
    shouldRevealRef.current = true;
    setView({ ...HOME });
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */
  const caption = revealing
    ? t.rendering
    : atLimit
      ? t.limit
      : t.deeper(formatMag(view.scale));

  const btnStyle: React.CSSProperties = {
    fontSize: "0.75rem",
    padding: "0.3em 0.7em",
    borderRadius: 999,
    cursor: "pointer",
    fontFamily: "inherit",
    background: "transparent",
    border: `1px solid ${theme ? theme.borderSoft : "transparent"}`,
    color: theme ? theme.muted : "inherit",
    transition: "color 0.2s ease, border-color 0.2s ease",
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
        onClick={(e) => zoomInAt(e.clientX, e.clientY)}
        aria-label="Conjunto de Mandelbrot interativo"
        style={{
          display: "block",
          width: `min(100%, ${DISPLAY_PX}px)`,
          aspectRatio: "1 / 1",
          background: "transparent",
          borderRadius: 10,
          cursor: "zoom-in",
          imageRendering: "auto",
          border: theme ? `1px solid ${theme.borderSoft}` : "none",
          touchAction: "manipulation",
        }}
      />

      {theme && (
        <>
          <span
            style={{
              marginTop: 10,
              fontSize: "0.8rem",
              lineHeight: 1.4,
              color: theme.subtle,
              fontStyle: "italic",
              textAlign: "center",
              minHeight: "1.2em",
            }}
          >
            {caption}
          </span>

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="button" style={btnStyle} onClick={zoomOut}>
              {t.zoomOut}
            </button>
            <button type="button" style={btnStyle} onClick={reset}>
              {t.reset}
            </button>
          </div>

          <span
            style={{
              marginTop: 8,
              fontSize: "0.72rem",
              lineHeight: 1.4,
              color: theme.muted,
              textAlign: "center",
              maxWidth: DISPLAY_PX,
            }}
          >
            {t.hint}
          </span>
        </>
      )}
    </div>
  );
}
