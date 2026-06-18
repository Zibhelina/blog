"use client";

import { useEffect, useRef } from "react";

const PHRASES = ["Hi, I'm Joao", "Welcome!"] as const;
const SCRAMBLE_CHARS = "#$%&/;:!?*+=-_";
const HOLD_MS = 1500;
const FRAME_MS = 42;
const SCRAMBLE_FRAMES = 18;

function randomChar() {
  return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)] ?? "#";
}

function scrambleFrame(next: string, width: number, frame: number) {
  const revealCount = Math.floor((frame / SCRAMBLE_FRAMES) * next.length);

  return Array.from({ length: width }, (_, index) => {
    if (index < revealCount && index < next.length) {
      return next[index];
    }

    if (index >= next.length && frame > SCRAMBLE_FRAMES * 0.6) {
      return "";
    }

    return randomChar();
  }).join("");
}

export function HeroScramble() {
  const textRef = useRef<HTMLSpanElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const textElement = textRef.current;
    const dotElement = dotRef.current;

    if (!textElement || !dotElement) {
      return;
    }

    let cancelled = false;
    let timeoutId: number | undefined;
    let phraseIndex = 0;

    const setDisplay = (value: string) => {
      textElement.textContent = value;
      dotElement.hidden = value !== PHRASES[0];
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(PHRASES[0]);
      return;
    }

    const schedule = (callback: () => void, delay: number) => {
      timeoutId = window.setTimeout(callback, delay);
    };

    const scrambleTo = (next: string, done: () => void) => {
      let frame = 0;
      const width = Math.max(textElement.textContent?.length ?? 0, next.length);
      dotElement.hidden = true;

      const step = () => {
        if (cancelled) {
          return;
        }

        frame += 1;

        if (frame > SCRAMBLE_FRAMES) {
          setDisplay(next);
          done();
          return;
        }

        textElement.textContent = scrambleFrame(next, width, frame);
        schedule(step, FRAME_MS);
      };

      step();
    };

    const loop = () => {
      const nextIndex = (phraseIndex + 1) % PHRASES.length;
      const next = PHRASES[nextIndex];

      schedule(() => {
        scrambleTo(next, () => {
          phraseIndex = nextIndex;
          loop();
        });
      }, HOLD_MS);
    };

    setDisplay(PHRASES[phraseIndex]);
    loop();

    return () => {
      cancelled = true;

      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <h1 className="hero-title" id="hero-title" aria-label="Hi, I'm Joao. Welcome!">
      <span aria-hidden="true" className="hero-scramble-text" ref={textRef}>
        {"Hi, I'm Joao"}
      </span>
      <span className="hero-dot" aria-hidden="true" ref={dotRef} />
    </h1>
  );
}
