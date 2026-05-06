import { cache } from "react";
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");
const PROJECTS_DIR = path.join(process.cwd(), "content", "projects");

type Frontmatter = Record<string, unknown>;

export type BlogPost = {
  slug: string;
  title: string;
  date: string;
  description?: string;
  draft: boolean;
  tags: string[];
  body: string;
};

export type Project = {
  slug: string;
  title: string;
  description: string;
  status?: string;
  stack: string[];
  url?: string;
  repo?: string;
  body: string;
};

async function listMdxFiles(directory: string) {
  const entries = await fs.readdir(directory, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"))
    .map((entry) => entry.name);
}

async function readMdx(directory: string, filename: string) {
  const fullPath = path.join(directory, filename);
  const source = await fs.readFile(fullPath, "utf8");
  const parsed = matter(source);

  return {
    body: parsed.content,
    data: parsed.data as Frontmatter,
    fullPath
  };
}

function slugFromFilename(filename: string) {
  return filename.replace(/\.mdx$/, "");
}

function requiredString(data: Frontmatter, key: string, fullPath: string) {
  const value = data[key];

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing required frontmatter field "${key}" in ${fullPath}`);
  }

  return value;
}

function requiredDate(data: Frontmatter, key: string, fullPath: string) {
  const value = data[key];

  if (typeof value === "string" && value.trim() !== "") {
    const trimmed = value.trim();
    parsePostDate(trimmed, fullPath);
    return trimmed;
  }

  throw new Error(`Missing required frontmatter field "${key}" in ${fullPath}`);
}

function optionalString(data: Frontmatter, key: string) {
  const value = data[key];
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function optionalBoolean(data: Frontmatter, key: string) {
  const value = data[key];
  return typeof value === "boolean" ? value : false;
}

function optionalStringArray(data: Frontmatter, key: string) {
  const value = data[key];

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string" && value.trim() !== "") {
    return [value];
  }

  return [];
}

function parsePostDate(value: string, fullPath?: string) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);

  if (!match) {
    throw new Error(
      `Invalid date${fullPath ? ` in ${fullPath}` : ""}: expected "DD-MM-YYYY", received "${value}"`
    );
  }

  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(
      `Invalid date${fullPath ? ` in ${fullPath}` : ""}: expected a real "DD-MM-YYYY" date, received "${value}"`
    );
  }

  return { date, day, month, year };
}

function sortPostsDescending(a: BlogPost, b: BlogPost) {
  return parsePostDate(b.date).date.getTime() - parsePostDate(a.date).date.getTime();
}

export const getAllPosts = cache(async (includeDrafts = false) => {
  const files = await listMdxFiles(BLOG_DIR);
  const posts = await Promise.all(
    files.map(async (filename): Promise<BlogPost> => {
      const { body, data, fullPath } = await readMdx(BLOG_DIR, filename);

      return {
        slug: slugFromFilename(filename),
        title: requiredString(data, "title", fullPath),
        date: requiredDate(data, "date", fullPath),
        description: optionalString(data, "description"),
        draft: optionalBoolean(data, "draft"),
        tags: optionalStringArray(data, "tags"),
        body
      };
    })
  );

  return posts
    .filter((post) => includeDrafts || !post.draft)
    .sort(sortPostsDescending);
});

export const getPostBySlug = cache(async (slug: string) => {
  const posts = await getAllPosts(true);
  return posts.find((post) => post.slug === slug);
});

export const getLatestPosts = cache(async (limit = 3) => {
  const posts = await getAllPosts();
  return posts.slice(0, limit);
});

export const getAllProjects = cache(async () => {
  const files = await listMdxFiles(PROJECTS_DIR);
  const projects = await Promise.all(
    files.map(async (filename): Promise<Project> => {
      const { body, data, fullPath } = await readMdx(PROJECTS_DIR, filename);

      return {
        slug: slugFromFilename(filename),
        title: requiredString(data, "title", fullPath),
        description: requiredString(data, "description", fullPath),
        status: optionalString(data, "status"),
        stack: optionalStringArray(data, "stack"),
        url: optionalString(data, "url"),
        repo: optionalString(data, "repo"),
        body
      };
    })
  );

  return projects.sort((a, b) => a.title.localeCompare(b.title));
});

export function toIsoDate(value: string) {
  const { day, month, year } = parsePostDate(value);
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
    .toString()
    .padStart(2, "0")}`;
}

export function formatDate(value: string) {
  const { date } = parsePostDate(value);

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC"
  }).format(date);
}
