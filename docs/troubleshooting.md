# Troubleshooting and limits

**No catalog appears.** Catalogs are only written for non-default locales. Check `locales` has more than one entry
and that the plugin is in `vite.plugins` (not `integrations`).

**A translation doesn't show.** The value dropped or renumbered a placeholder (`<0>`, `{1}`), so the source is shown.
Or the page isn't under `[locale]`: the locale comes from the first path segment.

**A string from data isn't translated.** It must be shown through an expression in an `.astro` template (`{item.title}`)
or passed as an island prop. Strings rendered only inside a `.tsx`/`.jsx` component, or built at runtime in the
browser, are not seen.

**A lowercase single word isn't in the catalog.** Single lowercase words in code look like ids (`"primary"`,
`"open"`), so they are skipped. In a template they are always extracted.

**My translation disappeared after editing a sentence.** It's kept as `lost: true` under the old key; copy it to the
new entry.

**The default locale has no catalog.** By design: templates are the source of truth for it.

**Server-rendered pages.** Work the same way; catalogs are bundled into the virtual module at build.

## Limits

- Pages must use a `[locale]` route segment (no domain-per-locale routing).
- Client-side strings (in islands' own code or in `<script>`) are not extracted.
- No ICU plural syntax; branch in the template instead.

Issues: [github.com/Peburu01/u1i18n/issues](https://github.com/Peburu01/u1i18n/issues).
