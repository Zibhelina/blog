import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description: "About João/Mqx."
};

export default function AboutPage() {
  return (
    <>
      <header className="page-header">
        <h1>About</h1>
        <p>A short placeholder for now.</p>
      </header>

      <div className="content">
        <p>
          This is a small personal website for João/Mqx. It exists as a place to publish notes, collect project
          references, and leave enough room for future interactive work.
        </p>
      </div>
    </>
  );
}
