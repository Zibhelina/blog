import type { ReactNode } from "react";
import { BrainActivation } from "@/components/applets/brain-activation";
import { ConceptGraph } from "@/components/applets/concept-graph";
import { DiffusionCat } from "@/components/applets/diffusion-cat";
import { SupportCallout } from "@/components/applets/support-callout";

export function Note({ children }: { children: ReactNode }) {
  return <aside className="mdx-note">{children}</aside>;
}

export function StudyLog({ children }: { children: ReactNode }) {
  return <section className="study-log">{children}</section>;
}

export const mdxComponents = {
  Note,
  StudyLog,
  BrainActivation,
  ConceptGraph,
  DiffusionCat,
  SupportCallout
};
