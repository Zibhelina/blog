# Personal Blog

A minimal, text-first personal website built with Next.js, TypeScript, and MDX. It is designed for publishing essays, notes, and project pages without a database or CMS.

## Features

- Blog posts written in MDX
- Translated post variants linked with `translationOf`
- Rendered study-log blocks with Markdown and KaTeX math support
- Project entries written in MDX
- Draft support for unpublished posts
- Static-friendly Next.js architecture
- Simple content structure under `content/`

## Tech Stack

- Next.js
- React
- TypeScript
- MDX
- KaTeX

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

The local dev script currently runs Next with webpack instead of Turbopack:

```bash
npm run dev
```

This avoids a local Turbopack reload loop seen while rendering MDX posts.

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

Translated versions are sibling MDX files with `translationOf` pointing to the source slug:

```mdx
---
title: "Translated post title"
date: "06-05-2026"
draft: false
translationOf: "source-post-slug"
---
```

Translations are built as direct routes and linked from the post language switcher, but hidden from the main blog index.

For rendered study-log excerpts, wrap normal Markdown in the `StudyLog` MDX component. Markdown headings, fenced code blocks, lists, and display math render inside the styled block:

```mdx
<StudyLog>

## Metrics

$$
\frac{2 × \mathrm{precision} × \mathrm{recall}}{\mathrm{precision} + \mathrm{recall}}
$$

</StudyLog>
```

## Deployment

The site can be deployed on Vercel using the default Next.js settings.

## License

This repository is currently unlicensed.
