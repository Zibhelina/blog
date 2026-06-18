"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Theme palette read live from the site's CSS custom properties.
 * Every value is a CSS color string (hex/rgb) safe to pass to
 * `new THREE.Color(value)` or to use directly in canvas/SVG fills.
 *
 * The site switches themes by toggling `data-theme` on <html>, so this
 * hook re-reads the variables whenever that attribute changes. Returns
 * `null` until mounted on the client (SSR-safe — render nothing or a
 * neutral placeholder while null).
 */
export type AppletTheme = {
  mode: "light" | "dark";
  background: string;
  foreground: string;
  muted: string;
  subtle: string;
  border: string;
  borderSoft: string;
  surface: string;
  codeBackground: string;
  green: string;
  aqua: string;
  red: string;
  yellow: string;
  orange: string;
  purple: string;
};

const VAR_MAP: Record<keyof Omit<AppletTheme, "mode">, string> = {
  background: "--background",
  foreground: "--foreground",
  muted: "--muted",
  subtle: "--subtle",
  border: "--border",
  borderSoft: "--border-soft",
  surface: "--surface",
  codeBackground: "--code-background",
  green: "--accent-green",
  aqua: "--accent-aqua",
  red: "--accent-red",
  yellow: "--accent-yellow",
  orange: "--accent-orange",
  purple: "--accent-purple"
};

function readTheme(): AppletTheme {
  const styles = getComputedStyle(document.documentElement);
  const get = (cssVar: string) => styles.getPropertyValue(cssVar).trim();

  const entries = Object.entries(VAR_MAP).map(([key, cssVar]) => [key, get(cssVar)]);
  const partial = Object.fromEntries(entries) as Omit<AppletTheme, "mode">;

  const colorScheme = get("color-scheme") || styles.colorScheme;
  const explicit = document.documentElement.getAttribute("data-theme");
  const mode: "light" | "dark" =
    explicit === "light" || explicit === "dark"
      ? explicit
      : colorScheme.includes("light")
        ? "light"
        : "dark";

  return { mode, ...partial };
}

export function useAppletTheme(): AppletTheme | null {
  const [theme, setTheme] = useState<AppletTheme | null>(null);

  useEffect(() => {
    setTheme(readTheme());

    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "style", "class"]
    });

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onMedia = () => setTheme(readTheme());
    media.addEventListener("change", onMedia);

    return () => {
      observer.disconnect();
      media.removeEventListener("change", onMedia);
    };
  }, []);

  return theme;
}

/**
 * True once mounted on the client AND the user has NOT requested reduced
 * motion. Use to decide whether to run an animation loop.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

/**
 * Tracks the pixel size of a container element via ResizeObserver.
 * Returns a ref to attach and the current { width, height }.
 */
export function useContainerSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, size } as const;
}
