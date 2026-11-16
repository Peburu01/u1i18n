# Getting started

u1i18n-astro translates an Astro site without translation keys. You write pages in one language as usual; the plugin
finds every piece of copy, writes a catalog per language, and swaps in the translations at render time.

## Requirements

- Node 20+ and Astro (the plugin uses Astro's Rust compiler, `@astrojs/compiler-rs`)
- Pages under a `[locale]` route segment

## 1. Install

```sh
npm install u1i18n-astro
```

## 2. Configure

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import { u1i18n } from 'u1i18n-astro';

const i18n = { locales: ['en', 'fr'], defaultLocale: 'en' };

export default defineConfig({
  i18n: { ...i18n, routing: { prefixDefaultLocale: true } },
  vite: { plugins: [u1i18n({ root: import.meta.dirname, ...i18n })] },
});
```

| Option | Default | Description |
|---|---|---|
| `root` | required | The site root, `import.meta.dirname`. |
| `locales` | required | Every locale, the default included. |
| `defaultLocale` | required | The language your templates are written in. |
| `dir` | `u1cms/i18n` | Where catalogs are written, relative to `root`. |

## 3. Move pages under `[locale]`

```
src/pages/[locale]/index.astro
src/pages/[locale]/about.astro
```

```astro
---
// src/pages/[locale]/about.astro
export const getStaticPaths = () => ['en', 'fr'].map((locale) => ({ params: { locale } }));
---
<h1>About us</h1>
<p>We build <a href="/en/work">websites</a> for <strong>small teams</strong>.</p>
```

The locale is the first path segment: `/en/about`, `/fr/about`. See [Routing](routing.md) for a redirect from `/`.

## 4. Run

```sh
npm run dev
```

`u1cms/i18n/fr.json` appears:

```json
{
  "src/pages/[locale]/about.astro#3f9a1c02be": { "text": "About us", "value": "" },
  "src/pages/[locale]/about.astro#a71e0c5d44": {
    "text": "We build <0>websites</0> for <1>small teams</1>.",
    "value": "",
    "slots": ["a", "strong"]
  }
}
```

## 5. Translate

Fill in `value`:

```json
"value": "Nous créons des <0>sites web</0> pour les <1>petites équipes</1>."
```

Save; the dev server reloads `/fr/about` with the translation. The link and the bold keep their attributes and
classes: translators only see words and numbered tags. Empty values fall back to the source text, so a half-translated
site still works.

Commit the catalogs with your code. They are kept in sync on every dev change and every build.
