# How extraction works

The plugin parses every `.astro` file under `src/` with Astro's own compiler and finds **messages**: blocks of copy
a translator should see as one sentence.

## Messages

A message is the text of one block element (paragraph, heading, list item, button, table cell, label…) or one copy
attribute. Inline elements inside it stay part of the sentence:

```astro
<p>Read the <a href="/en/guide" class="link">full guide</a> before <em>Friday</em>.</p>
```

→ `Read the <0>full guide</0> before <1>Friday</1>.`, slots `["a", "em"]`.

## Placeholders

| In the source | In the message |
|---|---|
| Inline element (`a`, `em`, `strong`, `span`, `button`, `code`…) | `<n>…</n>`; its words are translated, its attributes kept |
| Element without copy (`br`, `img`, `input`, `svg`, `code` block…) | `{n}` |
| Component (`<Icon />`, `<Link>`) | `{n}` or `<n>…</n>` |
| Expression (`{user.name}`, `{count}`) | `{n}` |

A translation may move or reorder placeholders but must keep all of them. One that doesn't (a tag deleted by
mistake) is ignored and the source text shows instead, so a bad translation never breaks a page.

## Attributes

These attributes are copy and become messages: `alt`, `title`, `placeholder`, `label`, `description`, `aria-label`,
`aria-description`, `aria-placeholder`, `aria-roledescription`.

On components, any string prop that reads like copy is translated, except wiring props: `class`, `id`, `href`,
`src`, `type`, `name`, `variant`, `size`, `icon`, `lang`, `date`, `on*`, `data-*`, `client:*`, `*Id(s)` and similar.

## Text from code

Copy that lives in frontmatter, `.ts`/`.js` modules, `.json` data files or content collections is translated by
value where the template shows it:

```astro
---
const features = [{ title: 'Fast builds', body: 'Ship in seconds.' }];
---
{features.map((f) => <h3>{f.title}</h3>)}
```

Every `{expression}` goes through `$t.v`, which looks the string up by its source text. The plugin also scans your
modules and JSON for strings that read like copy (they contain a space, or are one capitalised word), so they are in
the catalog to translate.

## Islands

React, Preact, Svelte or Vue islands (`client:*`) get their props through `$t.deep`: every string in the props,
nested objects and arrays included, is translated, while link keys (`href`, `url`, `to`…) are localised and wiring
keys are left alone. Put the copy in props from the `.astro` page rather than hard-coding it inside the island; text
written inside `.tsx`/`.jsx` files is not extracted.

## Never translated

- `<script>`, `<style>`, `<pre>`, `<code>`, `<kbd>`, `<samp>`, `<var>`, `<textarea>`, `<svg>`, `<math>`, `<template>`
- elements with `set:html`, `set:text` or `is:raw`
- strings that look like ids, URLs, paths, numbers, CSS classes or lowercase single words

See [Recipes → opting text out](recipes.md#opting-text-out).

## Keys

Each message key is `<file>#<hash>`, the first 10 hex characters of the SHA-256 of its text. Editing a sentence gives
it a new key; the old translation becomes `lost` (see [Catalogs](catalogs.md)). The same sentence used in two files
shares its translation automatically: a lookup falls back to any entry with the same source text.
