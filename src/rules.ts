// Which strings in code are copy. The same rules as the CMS's visual editor (@u1cms/visual source/rules), kept to what
// translation needs. Pure: the runtime uses them too.

/** Object keys and props whose strings are wiring: ids, links, styling, the values code compares. */
const WIRING = new Set([
  'class', 'className', 'style', 'id', 'key', 'ref', 'type', 'rel', 'target', 'for', 'htmlFor',
  'href', 'src', 'srcset', 'poster', 'url', 'link', 'path', 'to', 'slug', 'image', 'img', 'icon', 'as', 'variant',
  'size', 'color', 'tone', 'theme', 'lang', 'locale', 'date', 'datetime', 'method', 'action',
  'decoding', 'sizes', 'media', 'mode', 'layout', 'align', 'side', 'position', 'kind', 'template',
  'phone', 'email', 'tel',
]);
/**
 * Keys that are wiring as often as copy (`loading: "lazy"` / `loading: "Loading…"`, `value`, `format`, `status`): only
 * prose or a capitalised word under them is copy. (Not `role`: in content it's a person's role.)
 */
const EITHER = new Set(['value', 'loading', 'format', 'status']);

/** A key whose string is an id, a lookup, styling or a link: never translated. */
export const isWiringKey = (key: string) => WIRING.has(key) || /.Ids?$|^(on|data-|client:)/.test(key);
/** A key whose string is copy only when it reads like copy. */
export const isEitherKey = (key: string) => EITHER.has(key);

/** Class lists, CSS values and the like. */
function looksLikeCode(v: string) {
  if (/\b[a-z-]+\(/.test(v)) return true;
  const tokens = v.trim().split(/\s+/).filter(Boolean);
  const n = tokens.filter((t) => /[[\]{}<>=_;@|\\]|--|^[a-z][a-z0-9]*(-[a-z0-9.]+)+$|^[a-z]+:[^/]|^[a-z]+\/[\w.+-]+$/.test(t)).length;
  return n > 0 && n * 2 >= tokens.length;
}

const isUrl = (v: string) =>
  !/\s/.test(v) && (/^(\/|https?:\/\/|mailto:|tel:|#[\w-]|\.{1,2}\/)/.test(v) || /\.(png|jpe?g|webp|avif|gif|svg|mp4|webm|pdf)(\?.*)?$/i.test(v));

/** Content (an object field's value, a branch of a ternary that is shown): copy unless it looks like code or a link. */
export const isContent = (v: string) => /\p{L}/u.test(v) && !isUrl(v) && !looksLikeCode(v);

/** A loose string in code: prose or a capitalised word ("Team"), not an identifier, path or class list. */
export function isCopy(v: string) {
  const s = v.trim();
  if (!isContent(s)) return false;
  return /\s/.test(s) || /^\p{Lu}[\p{L}'’.!?…-]*$/u.test(s);
}
