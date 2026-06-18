"use client";

import { useEffect, useRef } from "react";

const SCRAMBLE_CHARS = "#$%&/;:!?*+=-_";
const HOLD_MS = 2000;
const FRAME_MS = 42;
const SCRAMBLE_FRAMES = 20;

function randomChar() {
  return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)] ?? "#";
}

/**
 * Build one frame of the scramble.
 * Characters reveal left-to-right; spaces are always preserved so word
 * boundaries stay stable.  The frame advances linearly from 1..SCRAMBLE_FRAMES.
 */
function scrambleFrame(chars: string[], frame: number): string {
  const revealCount = Math.floor((frame / SCRAMBLE_FRAMES) * chars.length);

  return chars
    .map((char, index) => {
      if (index < revealCount) return char;
      if (char === " ") return " ";
      return randomChar();
    })
    .join("");
}

interface PostTitleScrambleProps {
  title: string;
}

export function PostTitleScramble({ title }: PostTitleScrambleProps) {
  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const textElement = textRef.current;
    if (!textElement) return;

    let cancelled = false;
    let timeoutId: number | undefined;

    // Respect user preference — just show the static title.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const schedule = (callback: () => void, delay: number) => {
      timeoutId = window.setTimeout(callback, delay);
    };

    const scramble = (done: () => void) => {
      // Array.from handles Unicode codepoints (e.g. Portuguese accented chars) correctly.
      const chars = Array.from(title);
      let frame = 0;

      const step = () => {
        if (cancelled) return;

        frame += 1;

        if (frame > SCRAMBLE_FRAMES) {
          textElement.textContent = title;
          done();
          return;
        }

        textElement.textContent = scrambleFrame(chars, frame);
        schedule(step, FRAME_MS);
      };

      step();
    };

    const loop = () => {
      schedule(() => {
        scramble(() => {
          // After resolving, hold the clean title again before the next cycle.
          schedule(loop, HOLD_MS);
        });
      }, HOLD_MS);
    };

    // Start showing the real title (no layout flash for SSR / crawlers).
    textElement.textContent = title;
    loop();

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [title]);

  return (
    <h1 aria-label={title}>
      <span
        aria-hidden="true"
        ref={textRef}
        style={{ whiteSpace: "pre-wrap" }}
      >
        {title}
      </span>
    </h1>
  );
}
