import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { mdxComponents } from "@/components/mdx-components";
import { PostTitleScramble } from "@/components/post-title-scramble";
import type { BlogPost } from "@/lib/content";
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

function getLanguageVersions(post: BlogPost, posts: BlogPost[]) {
  const sourceSlug = post.translationOf ?? post.slug;
  const portuguesePost = posts.find((candidate) => candidate.slug === sourceSlug && !candidate.draft);
  const englishPost = posts.find(
    (candidate) => candidate.translationOf === sourceSlug && !candidate.draft
  );

  if (!portuguesePost || !englishPost) {
    return null;
  }

  return {
    currentLanguage: post.slug === englishPost.slug ? "en" : "pt",
    englishSlug: englishPost.slug,
    portugueseSlug: portuguesePost.slug
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const posts = await getAllPosts(true);
  const post = posts.find((candidate) => candidate.slug === slug);

  if (!post || post.draft) {
    notFound();
  }

  const languageVersions = getLanguageVersions(post, posts);

  return (
    <article>
      <header className="post-header">
        <time className="meta" dateTime={toIsoDate(post.date)}>
          {formatDate(post.date)}
        </time>
        <PostTitleScramble title={post.title} />
        {post.description ? <p>{post.description}</p> : null}
        {languageVersions ? (
          <nav className="language-switcher" aria-label="Language versions">
            <Link
              aria-current={languageVersions.currentLanguage === "pt" ? "page" : undefined}
              className={`language-switcher-link${
                languageVersions.currentLanguage === "pt" ? " is-active" : ""
              }`}
              href={`/blog/${languageVersions.portugueseSlug}`}
            >
              Português
            </Link>
            <Link
              aria-current={languageVersions.currentLanguage === "en" ? "page" : undefined}
              className={`language-switcher-link${
                languageVersions.currentLanguage === "en" ? " is-active" : ""
              }`}
              href={`/blog/${languageVersions.englishSlug}`}
            >
              English
            </Link>
          </nav>
        ) : null}
      </header>
      <div className="content">
        <MDXRemote
          components={mdxComponents}
          options={{
            mdxOptions: {
              rehypePlugins: [rehypeKatex],
              remarkPlugins: [remarkMath]
            }
          }}
          source={post.body}
        />
      </div>
    </article>
  );
}
