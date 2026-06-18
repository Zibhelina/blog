"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const storageKey = "mqx-theme";
const themeChangeEvent = "mqx-theme-change";
const defaultTheme: Theme = "dark";

function getStoredTheme(): Theme | null {
  const storedTheme = window.localStorage.getItem(storageKey);
  return storedTheme === "light" || storedTheme === "dark" ? storedTheme : null;
}

function getThemeSnapshot(): Theme {
  return getStoredTheme() ?? defaultTheme;
}

function subscribeToThemeChanges(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === storageKey) {
      onStoreChange();
    }
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(themeChangeEvent, onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(themeChangeEvent, onStoreChange);
  };
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="currentColor">
      <path d="M13.38 10.72A5.8 5.8 0 0 1 5.28 2.62 6.4 6.4 0 1 0 13.38 10.72Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 11.05A3.05 3.05 0 1 0 8 4.95a3.05 3.05 0 0 0 0 6.1ZM8 1.25c.34 0 .62.28.62.62v1.01a.62.62 0 1 1-1.24 0V1.87c0-.34.28-.62.62-.62Zm0 10.63c.34 0 .62.28.62.62v1.63a.62.62 0 1 1-1.24 0V12.5c0-.34.28-.62.62-.62ZM14.75 8a.62.62 0 0 1-.62.62H12.5a.62.62 0 1 1 0-1.24h1.63c.34 0 .62.28.62.62ZM4.12 8a.62.62 0 0 1-.62.62H1.87a.62.62 0 1 1 0-1.24H3.5c.34 0 .62.28.62.62Zm8.65-4.77c.24.24.24.64 0 .88l-.71.71a.62.62 0 0 1-.88-.88l.71-.71c.24-.24.64-.24.88 0ZM4.82 11.18c.24.24.24.64 0 .88l-.71.71a.62.62 0 1 1-.88-.88l.71-.71c.24-.24.64-.24.88 0Zm7.24 0 .71.71a.62.62 0 1 1-.88.88l-.71-.71a.62.62 0 1 1 .88-.88ZM4.11 3.23l.71.71a.62.62 0 0 1-.88.88l-.71-.71a.62.62 0 0 1 .88-.88Z" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg aria-hidden="true" className="theme-toggle-chevron" viewBox="0 0 16 16" fill="none">
      <path d="m4.75 6.25 3.25 3.5 3.25-3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToThemeChanges, getThemeSnapshot, () => defaultTheme);
  const nextTheme = theme === "dark" ? "light" : "dark";

  function toggleTheme() {
    applyTheme(nextTheme);
    window.localStorage.setItem(storageKey, nextTheme);
    window.dispatchEvent(new Event(themeChangeEvent));
  }

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${nextTheme} mode`}
      aria-pressed={theme === "dark"}
    >
      <span className="theme-toggle-icon">{theme === "dark" ? <MoonIcon /> : <SunIcon />}</span>
      <span className="theme-toggle-label">{theme === "dark" ? "Dark" : "Light"}</span>
      <ChevronIcon />
    </button>
  );
}
