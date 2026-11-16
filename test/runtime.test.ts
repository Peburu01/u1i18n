import { describe, expect, test } from 'bun:test';
import { createT } from '../src/runtime';

const locales = ['en', 'mr'];

describe('href with a prefixed default locale (default)', () => {
  test('/en/ links follow the page locale', () => {
    expect(createT({}, { locale: 'mr', defaultLocale: 'en', locales }).href('/en/contact/')).toBe('/mr/contact/');
    expect(createT({}, { locale: 'en', defaultLocale: 'en', locales }).href('/en/contact/')).toBe('/en/contact/');
  });
  test('unprefixed links are left alone', () => {
    expect(createT({}, { locale: 'mr', defaultLocale: 'en', locales }).href('/contact/')).toBe('/contact/');
  });
});

describe('href with the default locale at the root', () => {
  const mr = createT({}, { locale: 'mr', defaultLocale: 'en', locales, prefixDefaultLocale: false });
  const en = createT({}, { locale: 'en', defaultLocale: 'en', locales, prefixDefaultLocale: false });
  test('page links gain the translated locale', () => {
    expect(mr.href('/contact/')).toBe('/mr/contact/');
    expect(mr.href('/')).toBe('/mr/');
    expect(mr.href('/services/?a=1#x')).toBe('/mr/services/?a=1#x');
  });
  test('default-locale pages keep clean URLs', () => {
    expect(en.href('/contact/')).toBe('/contact/');
    expect(en.href('/en/contact/')).toBe('/contact/');
    expect(mr.href('/en/contact/')).toBe('/mr/contact/');
  });
  test('files, other locales, external links untouched', () => {
    expect(mr.href('/images/a.webp')).toBe('/images/a.webp');
    expect(mr.href('/mr/contact/')).toBe('/mr/contact/');
    expect(mr.href('https://x.com/')).toBe('https://x.com/');
    expect(mr.href('//cdn.x/a')).toBe('//cdn.x/a');
    expect(mr.href('#top')).toBe('#top');
  });
});
