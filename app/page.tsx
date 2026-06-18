import Link from "next/link";
import { formatDate, getAllProjects, getLatestPosts, toIsoDate } from "@/lib/content";

function GitHubIcon() {
  return (
    <svg aria-hidden="true" className="social-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.7.5.09.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.86.09-.67.35-1.12.64-1.38-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.95c.85 0 1.7.12 2.5.34 1.9-1.33 2.74-1.05 2.74-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.05.36.32.68.94.68 1.9 0 1.38-.01 2.49-.01 2.83 0 .27.18.59.69.49A10.05 10.05 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg aria-hidden="true" className="social-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.75 3H4.25C3.56 3 3 3.56 3 4.25v15.5c0 .69.56 1.25 1.25 1.25h15.5c.69 0 1.25-.56 1.25-1.25V4.25C21 3.56 20.44 3 19.75 3ZM8.34 18.34H5.67V9.75h2.67v8.59ZM7 8.58a1.55 1.55 0 1 1 0-3.1 1.55 1.55 0 0 1 0 3.1Zm11.34 9.76h-2.66v-4.18c0-1-.02-2.29-1.39-2.29-1.4 0-1.61 1.09-1.61 2.22v4.25h-2.66V9.75h2.55v1.17h.04c.36-.67 1.22-1.38 2.51-1.38 2.68 0 3.22 1.77 3.22 4.07v4.73Z" />
    </svg>
  );
}

function KofiIcon() {
  return (
    <svg aria-hidden="true" className="social-icon kofi-icon" viewBox="0 0 24 24" fill="none">
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
        fill="#ff5f5f"
      />
    </svg>
  );
}

const socialLinks = [
  {
    href: "https://github.com/Zibhelina",
    label: "GitHub",
    icon: <GitHubIcon />
  },
  {
    href: "https://www.linkedin.com/in/joao-araujo-098652195/",
    label: "LinkedIn",
    icon: <LinkedInIcon />
  },
  {
    href: "https://ko-fi.com/ksjhidf",
    label: "Ko-fi",
    icon: <KofiIcon />
  }
];

export default async function HomePage() {
  const [posts, projects] = await Promise.all([getLatestPosts(2), getAllProjects()]);

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <h1 id="hero-title">Hi, I&apos;m João.</h1>
        <p>
          A computer science student building small tools, writing notes, and experimenting with
          local-first AI workflows.
        </p>
        <ul className="social-links" aria-label="Social links">
          {socialLinks.map((link) => (
            <li key={link.href}>
              <a href={link.href} rel="noreferrer" target="_blank">
                {link.icon}
                <span>{link.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <div className="home-divider" aria-hidden="true" />

      <section className="section" aria-labelledby="latest-posts">
        <div className="section-header">
          <h2 id="latest-posts">Latest Posts</h2>
          <Link href="/blog">View all posts →</Link>
        </div>
        <ul className="entry-list">
          {posts.map((post) => (
            <li className="entry home-post-entry" key={post.slug}>
              <div className="entry-copy">
                <h3>
                  <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                </h3>
                <div className="entry-meta">
                  <time dateTime={toIsoDate(post.date)}>{formatDate(post.date)}</time>
                </div>
              </div>
              <Link className="pill-link" href={`/blog/${post.slug}`}>
                Read more →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="section" aria-labelledby="selected-projects">
        <div className="section-header">
          <h2 id="selected-projects">Selected Projects</h2>
          <Link href="/projects">View all projects →</Link>
        </div>
        <ul className="entry-list">
          {projects.slice(0, 2).map((project) => (
            <li className="entry project-entry" key={project.slug}>
              <div className="entry-copy">
                <h3>{project.title}</h3>
                <p>{project.description}</p>
              </div>
              {project.stack.length > 0 ? (
                <ul className="project-tags" aria-label={`${project.title} stack`}>
                  {project.stack.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
