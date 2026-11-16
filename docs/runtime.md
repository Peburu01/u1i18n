# Runtime API

Every `.astro` file with copy gets a page translator, `$t`, injected at the top of its frontmatter:

```js
import { translatorFor } from 'virtual:u1i18n';
const $t = translatorFor(Astro.url.pathname);
```

You don't write any of this; the rewritten template calls it. You can use `$t` yourself in frontmatter:

| Call | Returns |
|---|---|
| `$t(key, source, slots?)` | The translated message. Used by the rewritten template. |
| `$t.v(value)` | A string translated by its source text; anything else returned as-is. Leading and trailing whitespace is kept. |
| `$t.deep(value)` | Objects and arrays translated recursively (link keys localised, wiring keys left alone). |
| `$t.href(path)` | `/en/x` → `/fr/x` on a French page. |
| `$t.head` | The `<head>` additions for the locale (see [Typography](typography.md)); injected for you. |

```astro
---
const title = $t.v('Our services');          // "Nos services" on /fr/…
const cta = { label: 'Get started', href: '/en/start' };
const props = $t.deep(cta);                   // { label: 'Commencer', href: '/fr/start' }
---
<meta property="og:title" content={title} />
```

## Outside Astro

`createT` builds a translator from a catalog anywhere (scripts, tests, an API route):

```ts
import { createT } from 'u1i18n-astro/runtime';
import fr from '../u1cms/i18n/fr.json';

const t = createT(fr, { locale: 'fr', defaultLocale: 'en' });
t.v('Our services');
```

`u1i18n-astro/message` exports the message helpers (`fits`, `render`, `placeholdersOf`) for building translation
tools.
