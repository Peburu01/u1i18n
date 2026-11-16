# Recipes

## Opting text out

Text in `<code>`, `<pre>`, `<script>`, `<style>`, `<svg>` and elements with `set:html`/`set:text`/`is:raw` is never
extracted. For brand names or anything else that must stay as written, leave the `value` empty or put the same word in
`value` (an empty value always shows the source).

## Dates, numbers and plurals

Format them in code with the locale and put the result in an expression; the sentence around it becomes a message
with a `{n}` slot:

```astro
---
const { locale } = Astro.params;
const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(post.date);
const n = new Intl.NumberFormat(locale).format(count);
---
<p>Published {date}</p>
<p>{n} homes sold</p>
```

For plurals, branch in the template so each form is its own message:

```astro
{count === 1 ? <p>One home left</p> : <p>{count} homes left</p>}
```

## Page titles and meta

Strings in frontmatter go through `$t.v` when shown in an expression, including `<title>{title}</title>` and
`<meta content={description}>`. With [u1webcore](https://www.npmjs.com/package/u1webcore), set the title in the
page and u1webcore picks up the translated one.

## Checking in CI

The catalog is rewritten on build. Fail the build if it changed (someone added copy without committing the catalog):

```sh
npm run build && git diff --exit-code u1cms/i18n
```

List untranslated messages:

```sh
node -e "const c=require('./u1cms/i18n/fr.json');for(const[k,e]of Object.entries(c))if(!e.value&&!e.lost)console.log(e.text)"
```

## Machine translation

Fill `value` from any MT service with a script that reads the catalog, sends `text`, and writes `value`. Keep the
`<n>`/`{n}` placeholders in the request (most services leave XML-like tags alone); u1i18n ignores results that drop
one.

## With the U1CMS visual editor

When `@u1cms/visual` is in the Vite plugins, the editor runs the template rewrite itself after tagging the source,
so editing and translating work on the same page. Nothing to configure.
