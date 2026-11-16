# Routing and links

## Routes

Every translated page lives under `src/pages/[locale]/`. The translator for a request is picked from the first path
segment; an unknown segment uses the default locale.

A small helper keeps `getStaticPaths` short:

```ts
// src/lib/locales.ts
import { i18n } from 'astro:config/client';

export const locales = (i18n?.locales ?? ['en']).map((l) => (typeof l === 'string' ? l : l.path));

export const everyLocale = <T extends Record<string, string>>(params: T[] = [{} as T]) =>
  locales.flatMap((locale) => params.map((p) => ({ params: { ...p, locale } })));
```

```astro
---
// src/pages/[locale]/index.astro
import { everyLocale } from '@/lib/locales';
export const getStaticPaths = () => everyLocale();
---
```

```astro
---
// src/pages/[locale]/blog/[slug].astro
import { getCollection } from 'astro:content';
import { everyLocale } from '@/lib/locales';
export const getStaticPaths = async () => everyLocale((await getCollection('blog')).map((p) => ({ slug: p.id })));
---
```

Send `/` to the default language with an Astro redirect (`redirects: { '/': '/en' }`) or a root `index.astro`.

## Links

Write links in the default locale: `<a href="/en/contact">`. On translated pages they are rewritten to the current
locale (`/fr/contact`), in templates, in island props and in data. Only links that start with `/<defaultLocale>`
followed by `/`, `?`, `#` or the end are changed; external links and other paths are left alone.

In your own code use `$t.href('/en/contact')`.

## Language switcher

Swap the first segment of the current path:

```astro
---
import { locales } from '@/lib/locales';
const [, current, ...rest] = Astro.url.pathname.split('/');
---
<nav aria-label="Language">
  {locales.map((l) => <a href={`/${[l, ...rest].join('/')}`} aria-current={l === current ? 'true' : undefined} lang={l}>{l.toUpperCase()}</a>)}
</nav>
```

Set `<html lang={Astro.params.locale}>` in your layout. For hreflang, sitemap alternates and `og:locale`, add
[u1webcore](https://www.npmjs.com/package/u1webcore) with its `languages` settings.
