# Typography

Many designs use `letter-spacing` on headings and labels. In scripts where letters join or stack, such as Arabic,
Hebrew, Devanagari (Hindi, Marathi), Bengali, Gurmukhi, Gujarati, Tamil, Telugu, Kannada, Malayalam, Odia, Sinhala,
Thai, Lao, Khmer, Myanmar and Tibetan, letter-spacing breaks the words apart.

On a page in one of those locales, u1i18n-astro adds to the end of `<head>`:

```html
<style>html:lang(mr) *{letter-spacing:normal!important}</style>
```

The script comes from the locale tag (`Intl.Locale(locale).maximize().script`), so `mr`, `hi`, `ar`, `ta` all work.
Your layout needs `<html lang={locale}>` for the selector to match.

Other things to check for these languages:

- fonts: load one that covers the script (Noto Sans Devanagari, Noto Naskh Arabic…)
- right-to-left: set `dir="rtl"` on `<html>` for Arabic and Hebrew, and prefer logical CSS (`margin-inline-start`)
- `text-transform: uppercase` has no effect on most of these scripts; don't rely on it for emphasis
- translated text is often 20–40% longer than English; leave room in buttons and nav
