# Personal Blog

A minimal, text-first personal website built with Next.js, TypeScript, and MDX. It is designed for publishing essays, notes, and project pages without a database or CMS.

## Features

- Blog posts written in MDX
- Project entries written in MDX
- Draft support for unpublished posts
- Static-friendly Next.js architecture
- Simple content structure under `content/`

## Tech Stack

- Next.js
- React
- TypeScript
- MDX

## Local Development

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Then open:

```txt
http://localhost:3000
```

To check the production build:

```bash
npm run build
```

## Content

Blog posts live in:

```txt
content/blog/
```

Projects live in:

```txt
content/projects/
```

Each content file uses frontmatter for metadata and MDX for the body.

Example blog post:

```mdx
---
title: "Post title"
date: "06-05-2026"
description: "Optional short summary shown in post lists."
tags:
  - example
draft: false
---

Write the post here.
```

Dates use the `DD-MM-YYYY` format. Set `draft: true` to keep a post out of public routes and lists.

## Deployment

The site can be deployed on Vercel using the default Next.js settings.

## License

This repository is currently unlicensed.
