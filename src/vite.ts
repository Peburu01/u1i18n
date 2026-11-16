// The Vite plugin. Keeps each translated locale's catalog (u1cms/i18n/<locale>.json) up to date with the site's
// messages (templates, and the copy in its code: data files, collections): at build start, and in dev whenever a
// source file changes (the CMS saves what its container writes).
// It rewrites each template in memory so every message goes through the translator, in builds and in dev. In the CMS,
// the visual editor tags text by its position in the file first, then hands its tagged code to `api.rewrite`.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';
import { merge, type Catalog } from './catalog';
import { analyze, analyzeModule } from './extract';

export type Options = {
  /** The site's root (`import.meta.dirname` in astro.config). */
  root: string;
  /** Every locale of the site, the default one included. */
  locales: string[];
  /** The locale the templates are written in. */
  defaultLocale: string;
  /** Where the catalogs are, from the root. */
  dir?: string;
};

const VIRTUAL = 'virtual:u1i18n';

/** Templates, code modules and data files (islands' .tsx/.jsx get their copy from the page, as props). */
const SOURCE = /\.(astro|[mc]?[jt]s|json)$/;
/** Not type declarations, nor a tool's config file (`site.u1wc.json`). */
const isSource = (name: string) => SOURCE.test(name) && !name.endsWith('.d.ts') && !/\.[\w-]+\.json$/.test(name);

function sourcesIn(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourcesIn(path);
    return isSource(name) ? [path] : [];
  });
}

function messagesOf(file: string, path: string) {
  const source = readFileSync(file, 'utf8');
  if (file.endsWith('.astro')) return analyze(source, path).messages;
  // A JSON file is the module that exports it.
  return analyzeModule(file.endsWith('.json') ? `export default ${source}` : source, path);
}

export function u1i18n({ root, locales, defaultLocale, dir = 'u1cms/i18n' }: Options): Plugin {
  const src = join(root, 'src');
  const translated = locales.filter((l) => l !== defaultLocale);
  const fileOf = (locale: string) => join(root, dir, `${locale}.json`);
  const read = (locale: string): Catalog => (existsSync(fileOf(locale)) ? JSON.parse(readFileSync(fileOf(locale), 'utf8')) : {});
  let rewrite = false;

  /** A template with every message going through the page's translator; undefined when it has none. */
  const withTranslator = (source: string, id: string) => {
    const { code } = analyze(source, relative(root, id));
    if (code === source) return undefined;
    const setup = `import { translatorFor } from '${VIRTUAL}';\nconst $t = translatorFor(Astro.url.pathname);\n`;
    const fence = /^\s*---\r?\n/.exec(code);
    return fence ? code.slice(0, fence[0].length) + setup + code.slice(fence[0].length) : `---\n${setup}---\n${code}`;
  };

  /** Brings every translated locale's catalog up to date; writes only the ones that changed. */
  const sync = () => {
    if (!translated.length) return;
    const found = sourcesIn(src).flatMap((f) => messagesOf(f, relative(root, f)));
    mkdirSync(join(root, dir), { recursive: true });
    for (const l of translated) {
      const text = `${JSON.stringify(merge(read(l), found), null, 2)}\n`;
      if (!existsSync(fileOf(l)) || readFileSync(fileOf(l), 'utf8') !== text) writeFileSync(fileOf(l), text);
    }
  };

  return {
    name: 'u1i18n',
    enforce: 'pre',
    configResolved(config) {
      // With the visual editor, it calls `api.rewrite` itself, after tagging the source.
      rewrite = config.command === 'build' || !config.plugins.some((p) => p.name === '@u1cms/visual');
    },
    buildStart: sync,
    configureServer(server) {
      const changed = (file: string) => {
        if (file.startsWith(src) && isSource(file)) sync();
      };
      server.watcher.on('change', changed).on('add', changed).on('unlink', changed);
      // A catalog saved (by the CMS, or by hand): the pages pick up its translations.
      server.watcher.on('change', (file) => {
        const mod = file.startsWith(join(root, dir)) && file.endsWith('.json') && server.moduleGraph.getModuleById(`\0${VIRTUAL}`);
        if (!mod) return;
        server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      });
    },
    resolveId: (id) => (id === VIRTUAL ? `\0${VIRTUAL}` : undefined),
    load(id) {
      if (id === `\0${VIRTUAL}`) {
        // The translator for a page: its locale is the first segment of its path (`/fr/…`).
        const catalogs = Object.fromEntries(translated.map((l) => [l, read(l)]));
        return `import { createT } from 'u1i18n-astro/runtime';
const catalogs = ${JSON.stringify(catalogs)};
const locales = ${JSON.stringify(locales)};
export const translatorFor = (path) => {
  const locale = path.split('/')[1];
  return createT(catalogs[locale], { locale: locales.includes(locale) ? locale : ${JSON.stringify(defaultLocale)}, defaultLocale: ${JSON.stringify(defaultLocale)} });
};`;
      }
      // The template as Astro will compile it: read here, before any transform, so positions are the file's own.
      if (!rewrite || !id.startsWith(src) || !id.endsWith('.astro')) return undefined;
      return withTranslator(readFileSync(id, 'utf8'), id);
    },
    api: { rewrite: (code: string, id: string) => (id.startsWith(src) && id.endsWith('.astro') ? withTranslator(code, id) : undefined) },
  };
}
