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
    if (theme === "light" || theme === "dark") {
      document.documentElement.dataset.theme = theme;
    }
  } catch (_) {}
})();`
          }}
        />
      </head>
      <body>
        <header className="site-header">
          <nav className="site-nav" aria-label="Main navigation">
            <Link className="site-title" href="/">
              Home
            </Link>
            <div className="site-actions">
              <div className="site-links">
                <Link href="/blog">Blog</Link>
                <Link href="/projects">Projects</Link>
              </div>
              <ThemeToggle />
            </div>
          </nav>
        </header>
        <main className="site-main">{children}</main>
      </body>
    </html>
  );
}
