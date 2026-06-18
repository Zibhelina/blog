import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "joao-blog",
    template: "%s | joao-blog"
  },
  description: "A small personal website for writing and projects."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
  try {
    const theme = window.localStorage.getItem("mqx-theme");
    document.documentElement.dataset.theme = theme === "light" || theme === "dark" ? theme : "dark";
  } catch (_) {
    document.documentElement.dataset.theme = "dark";
  }
})();`
          }}
        />
      </head>
      <body>
        <header className="site-header">
          <nav className="site-nav" aria-label="Main navigation">
            <div className="site-links">
              <Link href="/">Home</Link>
              <Link href="/blog">Blog</Link>
              <Link href="/projects">Projects</Link>
            </div>
            <ThemeToggle />
          </nav>
        </header>
        <main className="site-main">{children}</main>
        <footer className="site-footer">© 2026 João • Built with Next.js &amp; MDX</footer>
      </body>
    </html>
  );
}
