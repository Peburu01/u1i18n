// The translator a page calls. `$t(key, source, slots?)` gives the locale's translation of a template message (when it
// keeps the source's placeholders), else the source text; with slots, the parts to render. `$t.v(value)` translates a
// value the page shows (a string from data, a collection, a ternary) by its text; `$t.deep(value)` does the same for
// every string in an island's props. A text translated once is translated everywhere it appears. `$t.href(link)` points
// a link at the default locale's pages (`/en/…`) to the same page in the page's locale. `$t.head` is what the page's
// <head> needs for its script.
import { fits, placeholdersOf, render } from './message';
import { isWiringKey } from './rules';

type Catalog = Record<string, { text?: string; value: string }>;

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
/** The CMS editor's invisible source marker at the end of a string (dev, in the CMS): kept on the translation. */
const MARKER = /[\u200b-\u200d\ufeff]+$/;

const isLinkKey = (key: string) => key === 'to' || /(href|link|url)$/i.test(key);

/** Scripts whose letters join into clusters: letter-spacing (a Latin design's tracked labels) pulls them apart. */
const JOINED = new Set(['Arab', 'Beng', 'Deva', 'Gujr', 'Guru', 'Hebr', 'Khmr', 'Knda', 'Laoo', 'Mlym', 'Mymr', 'Orya', 'Sinh', 'Taml', 'Telu', 'Thai', 'Tibt']);
/** What a translated page needs in its <head>: no letter-spacing when its script joins letters. */
function headFor(locale: string | undefined) {
  let script = '';
  try {
    script = locale ? (new Intl.Locale(locale).maximize().script ?? '') : '';
  } catch {
    // Not a locale tag: nothing to add.
  }
  return JOINED.has(script) ? `<style>html:lang(${locale}) *{letter-spacing:normal!important}</style>` : '';
}

export function createT(catalog: Catalog = {}, { locale, defaultLocale }: { locale?: string; defaultLocale?: string } = {}) {
  const byText = new Map<string, string>();
  for (const e of Object.values(catalog)) if (e.text && e.value && !byText.has(e.text) && fits(e.value, e.text)) byText.set(e.text, e.value);

  const t = (key: string, source: string, slots?: unknown[]) => {
    const own = catalog[key]?.value;
    const text = own && fits(own, source) ? own : (byText.get(source) ?? source);
    if (!slots) return text;
    const parts = render(text, slots);
    // Values only, all strings (a title built from values): one string, so it works in attributes and props too.
    const plain = !/<\d+>/.test(source) && parts.every((p) => typeof p === 'string' || typeof p === 'number');
    return plain ? parts.join('') : parts;
  };
  const v = <T>(value: T): T => {
    if (typeof value !== 'string') return value;
    const marker = MARKER.exec(value)?.[0] ?? '';
    const text = value.slice(0, value.length - marker.length);
    const s = norm(text);
    const to = byText.get(s);
    if (!to || placeholdersOf(s).length) return value;
    return (text.match(/^\s*/)![0] + to + text.match(/\s*$/)![0] + marker) as T;
  };
  const from = `/${defaultLocale}`;
  const href = <T>(value: T): T =>
    typeof value === 'string' && locale && locale !== defaultLocale && (value === from || value.startsWith(`${from}/`) || value.startsWith(`${from}?`) || value.startsWith(`${from}#`))
      ? (`/${locale}${value.slice(from.length)}` as T)
      : value;
  const deep = <T>(value: T): T => {
    if (Array.isArray(value)) return value.map(deep) as T;
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype)
      return Object.fromEntries(Object.entries(value).map(([k, x]) => [k, isLinkKey(k) ? href(x) : isWiringKey(k) ? x : deep(x)])) as T;
    return v(value);
  };
  return Object.assign(t, { v, deep, href, head: locale && locale !== defaultLocale ? headFor(locale) : '' });
}
