# u1i18n — zero-markup i18n for Astro

[![npm](https://img.shields.io/npm/v/u1i18n)](https://www.npmjs.com/package/u1i18n)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**Translate an Astro site without touching its templates.** No `t('hero.title')` calls, no key files, no wrapping every string. Write your pages in one language as plain HTML; u1i18n finds every piece of copy at build time and serves it in each locale.

```astro
<!-- Your template stays exactly like this -->
<h1>Homes built to <em>last generations</em></h1>
<a href="/contact">Talk to our team</a>
```

```json
// u1cms/i18n/ta.json — generated, you only fill in "value"
{
  "src/pages/index.astro#2bd873d6c7": {
    "text": "Homes built to <0>last generations</0>",
    "value": "தலைமுறைகள் <0>நிலைக்கும்</0> வீடுகள்"
  }
}
```

## Why u1i18n

- **Zero markup** — no translation functions or keys in your source. Designers and writers edit pages as normal HTML.
- **Automatic extraction** — every heading, paragraph, button, `alt`, `title`, `aria-label` and `placeholder` is found by parsing your `.astro` files with the official Astro compiler.
- **Sentences stay whole** — inline elements (`<a>`, `<em>`, `<strong>`, components) become numbered placeholders, so translators can reorder words naturally. A translation that drops a placeholder falls back to the source instead of breaking the page.
- **Data and collections too** — strings from frontmatter, data files and content collections are translated by value where the page shows them, including island (React/Vue/Svelte) props.
- **Translate once** — the same text appearing on many pages is translated everywhere at once.
- **Catalogs that never lose work** — plain JSON per locale, kept in sync in dev and at build. Changed copy is re-queued; translations of removed copy are kept, marked `lost`, not deleted.
- **Localised links** — links to `/en/…` pages point to the same page in the visitor's locale.
- **Script-aware typography** — tracked-out Latin labels don't break Tamil, Hindi, Arabic, Thai and other joined scripts.
- **Static and fast** — translation happens at build; no runtime i18n library shipped to the browser.
- **CMS-ready** — the catalog format is designed for visual editing (placeholders show as chips in [U1CMS](https://github.com/Peburu01)).

## Install

```sh
npm install u1i18n
```

## Usage

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import { u1i18n } from 'u1i18n';

const i18n = { locales: ['en', 'ta'], defaultLocale: 'en' };

export default defineConfig({
  i18n: { ...i18n, routing: { prefixDefaultLocale: true } },
  vite: {
    plugins: [u1i18n({ root: import.meta.dirname, ...i18n })],
  },
});
```

Put pages under `src/pages/[locale]/`. On the next `astro dev` or `astro build`, a catalog appears at `u1cms/i18n/<locale>.json` for every non-default locale. Fill in each `value`; empty ones fall back to the source text.

### Options

| Option | | |
|---|---|---|
| `root` | required | The site root (`import.meta.dirname`) |
| `locales` | required | Every locale, the default included |
| `defaultLocale` | required | The language the templates are written in |
| `dir` | `u1cms/i18n` | Where the catalogs live |

## How it compares

| | u1i18n | Key-based i18n libraries |
|---|---|---|
| Markup in templates | none | `t()` call per string |
| Key naming | automatic | manual |
| Inline links and formatting | kept as placeholders | split strings or HTML in JSON |
| Data/collection strings | automatic | manual |

## Related

- [u1webcore](https://www.npmjs.com/package/u1webcore) — SEO, JSON-LD, sitemaps, hreflang and llms.txt for Astro.

## License

[MIT](LICENSE)
