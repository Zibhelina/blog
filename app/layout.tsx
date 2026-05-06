import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "João/Mqx",
    template: "%s | João/Mqx"
  },
  description: "A small personal website for writing and projects."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <nav className="site-nav" aria-label="Main navigation">
            <Link className="site-title" href="/">
              Home
            </Link>
            <div className="site-links">
              <Link href="/blog">Blog</Link>
              <Link href="/projects">Projects</Link>
              <Link href="/about">About</Link>
            </div>
          </nav>
        </header>
        <main className="site-main">{children}</main>
      </body>
    </html>
  );
}
