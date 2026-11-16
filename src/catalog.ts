// A locale's catalog: one entry per message key. `text` is the source message, `value` its translation (empty until
// translated), `slots` what its placeholders stand for, `lost` a translated message no longer in the source.
import type { Message } from './extract';

export type Entry = { text: string; value: string; slots?: string[]; lost?: boolean };
export type Catalog = Record<string, Entry>;

/** The catalog brought up to date with the site's messages. A translated message that left the source is kept as lost. */
export function merge(catalog: Catalog, found: Message[]): Catalog {
  const next: Catalog = {};
  for (const m of found) next[m.key] = { text: m.text, value: catalog[m.key]?.value ?? '', ...(m.slots.length ? { slots: m.slots } : {}) };
  for (const [key, e] of Object.entries(catalog)) if (!next[key] && e.value) next[key] = { ...e, lost: true };
  return next;
}
