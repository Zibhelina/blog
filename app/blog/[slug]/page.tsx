import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { mdxComponents } from "@/components/mdx-components";
import { formatDate, getAllPosts, getPostBySlug, toIsoDate } from "@/lib/content";

type BlogPostPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamicParams = false;

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({
    slug: post.slug
  }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post || post.draft) {
    return {};
  }

  return {
    title: post.title,
    description: post.description
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post || post.draft) {
    notFound();
  }

  return (
    <article>
      <header className="post-header">
        <time className="meta" dateTime={toIsoDate(post.date)}>
          {formatDate(post.date)}
        </time>
        <h1>{post.title}</h1>
        {post.description ? <p>{post.description}</p> : null}
      </header>
      <div className="content">
        <MDXRemote components={mdxComponents} source={post.body} />
      </div>
    </article>
  );
}
