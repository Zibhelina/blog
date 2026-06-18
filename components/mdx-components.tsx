import type { ReactNode } from "react";

export function Note({ children }: { children: ReactNode }) {
  return <aside className="mdx-note">{children}</aside>;
}

export function StudyLog({ children }: { children: ReactNode }) {
  return <section className="study-log">{children}</section>;
}

export const mdxComponents = {
  Note,
  StudyLog
};
