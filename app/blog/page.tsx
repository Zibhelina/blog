import type { Metadata } from "next";
import Link from "next/link";
import { formatDate, getAllPosts, toIsoDate } from "@/lib/content";

export const metadata: Metadata = {
  title: "Blog",
  description: "Posts from João/Mqx."
};

export default async function BlogIndexPage() {
  const posts = await getAllPosts();

  return (
    <>
      <header className="page-header">
        <h1>Blog</h1>
        <p>Notes and longer writing, listed newest first.</p>
      </header>

      <ul className="entry-list">
        {posts.map((post) => (
          <li className="entry" key={post.slug}>
            <h2>
              <Link href={`/blog/${post.slug}`}>{post.title}</Link>
            </h2>
            <div className="entry-meta">
              <time dateTime={toIsoDate(post.date)}>{formatDate(post.date)}</time>
            </div>
            {post.description ? <p>{post.description}</p> : null}
          </li>
        ))}
      </ul>
    </>
  );
}
