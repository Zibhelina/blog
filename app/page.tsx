import Image from "next/image";
import Link from "next/link";
import catProfile from "../cat-profile.png";
import { formatDate, getAllProjects, getLatestPosts, toIsoDate } from "@/lib/content";

export default async function HomePage() {
  const [posts, projects] = await Promise.all([getLatestPosts(3), getAllProjects()]);

  return (
    <>
      <section className="intro" aria-labelledby="profile-name">
        <div className="profile-avatar" aria-hidden="true">
          <Image
            className="profile-image"
            src={catProfile}
            alt=""
            priority
            sizes="(max-width: 600px) 112px, 168px"
          />
        </div>
        <div className="profile-copy">
          <dl className="profile-details" aria-label="Profile details">
            <div>
              <dt>name:</dt>
              <dd className="profile-name" id="profile-name">João</dd>
            </div>
            <div>
              <dt>about me:</dt>
              <dd>A computer science student building small tools, writing notes, and experimenting with local-first AI workflows.</dd>
            </div>
            <div>
              <dt>links:</dt>
              <dd className="profile-links">
                <a href="https://github.com/" rel="noreferrer" target="_blank">
                  GitHub
                </a>
                <a href="https://www.linkedin.com/in/joao-araujo-098652195/" rel="noreferrer" target="_blank">
                  LinkedIn
                </a>
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="section" aria-labelledby="latest-posts">
        <div className="section-header">
          <h2 id="latest-posts">Latest Posts</h2>
          <Link href="/blog">All posts</Link>
        </div>
        <ul className="entry-list">
          {posts.map((post) => (
            <li className="entry" key={post.slug}>
              <h3>
                <Link href={`/blog/${post.slug}`}>{post.title}</Link>
              </h3>
              <div className="entry-meta">
                <time dateTime={toIsoDate(post.date)}>{formatDate(post.date)}</time>
              </div>
              {post.description ? <p>{post.description}</p> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="section" aria-labelledby="selected-projects">
        <div className="section-header">
          <h2 id="selected-projects">Selected Projects</h2>
          <Link href="/projects">All projects</Link>
        </div>
        <ul className="entry-list">
          {projects.slice(0, 2).map((project) => (
            <li className="entry" key={project.slug}>
              <h3>{project.title}</h3>
              <p>{project.description}</p>
              {project.stack.length > 0 ? <p className="project-stack">{project.stack.join(", ")}</p> : null}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
