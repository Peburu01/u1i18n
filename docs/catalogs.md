# Catalogs

One JSON file per translated locale, at `u1cms/i18n/<locale>.json` (or your `dir`). The default locale has none.

```json
{
  "src/pages/[locale]/index.astro#3f9a1c02be": {
    "text": "Book a <0>free</0> call",
    "value": "Réservez un appel <0>gratuit</0>",
    "slots": ["strong"]
  },
  "src/components/Footer.astro#0b1d77e2a9": {
    "text": "All rights reserved.",
    "value": "Tous droits réservés.",
    "lost": true
  }
}
```

| Field | Description |
|---|---|
| `text` | The source message. Don't edit it: change the page instead. |
| `value` | The translation. Empty = show the source text. |
| `slots` | What each placeholder stands for (`a`, `strong`, `Icon`, `project.title`), for translators. |
| `lost` | The message is no longer in the source. Kept so a translation isn't thrown away when copy is edited. |

## Sync

On `astro dev` (every source change) and `astro build`, every catalog is rebuilt from the source:

- new messages are added with an empty `value`
- existing translations are kept
- translated messages that disappeared are kept with `lost: true`; untranslated ones are dropped
- a file is only written when it changes, so it doesn't churn in git

When you reword a sentence, look for a `lost` entry with the old text, reuse its translation for the new entry,
then delete the lost one.

## Translating

Any tool that edits JSON works: your editor, a script, a translation platform's JSON import, or the U1CMS editor,
which shows each message in context with lost-entry suggestions. When a catalog is saved, the dev server reloads the
page with the new translations.

Rules for translators:

- keep every `<n>…</n>` and `{n}`; reorder them freely
- `<0>` in the source must be `<0>` in the translation, wrapping the words that should carry that formatting
- leave `value` empty rather than copying the source text
