import type { ReactNode } from "react";

export function Note({ children }: { children: ReactNode }) {
  return <aside className="mdx-note">{children}</aside>;
}

export const mdxComponents = {
  Note
};
