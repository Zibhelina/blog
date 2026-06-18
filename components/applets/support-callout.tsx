import type { ReactNode } from "react";

const KOFI_URL = "https://ko-fi.com/ksjhidf";
const LINKEDIN_URL = "https://www.linkedin.com/in/joao-araujo-098652195/";

function KofiIcon() {
  return (
    <svg aria-hidden="true" className="support-icon kofi-icon" viewBox="0 0 24 24" fill="none">
      <path
        d="M4.75 7.25h11.8v5.9a4.6 4.6 0 0 1-4.6 4.6h-2.6a4.6 4.6 0 0 1-4.6-4.6v-5.9Z"
        fill="currentColor"
      />
      <path
        d="M16.55 9.25h1.2a2.25 2.25 0 0 1 0 4.5h-1.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M10.7 14.15 8.52 11.9a1.34 1.34 0 0 1 1.9-1.9l.28.28.28-.28a1.34 1.34 0 1 1 1.9 1.9l-2.18 2.25Z"
        fill="var(--accent-red)"
      />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg aria-hidden="true" className="support-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.75 3H4.25C3.56 3 3 3.56 3 4.25v15.5c0 .69.56 1.25 1.25 1.25h15.5c.69 0 1.25-.56 1.25-1.25V4.25C21 3.56 20.44 3 19.75 3ZM8.34 18.34H5.67V9.75h2.67v8.59ZM7 8.58a1.55 1.55 0 1 1 0-3.1 1.55 1.55 0 0 1 0 3.1Zm11.34 9.76h-2.66v-4.18c0-1-.02-2.29-1.39-2.29-1.4 0-1.61 1.09-1.61 2.22v4.25h-2.66V9.75h2.55v1.17h.04c.36-.67 1.22-1.38 2.51-1.38 2.68 0 3.22 1.77 3.22 4.07v4.73Z" />
    </svg>
  );
}

function SupportLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="support-link" href={href} rel="noreferrer" target="_blank">
      {children}
    </a>
  );
}

/**
 * Tongue-in-cheek end-of-post callout. Copy is passed in as props so each post
 * (PT / EN) controls its own wording while the links and logos stay in one place.
 *
 * Renders: {before} <Ko-fi logo> {middle} <LinkedIn logo>{after}
 */
export function SupportCallout({
  before,
  middle,
  after = "."
}: {
  before: string;
  middle: string;
  after?: string;
}) {
  return (
    <aside className="support-callout">
      <p>
        {before}{" "}
        <SupportLink href={KOFI_URL}>
          <KofiIcon />
        </SupportLink>{" "}
        {middle}{" "}
        <SupportLink href={LINKEDIN_URL}>
          <LinkedInIcon />
        </SupportLink>
        {after}
      </p>
    </aside>
  );
}

export default SupportCallout;
