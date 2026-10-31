# Carlos Campos — personal website

A static Astro website focused on software engineering, technical leadership, and product. Repository: [camtes/landing](https://github.com/camtes/landing). GitHub hosts the source; publishing the website to a VPS is a separate step.

## Development

Requirements: Node.js >=22.23.4 and npm >=9.6.5, as declared by the installed Astro 7.4.4 package.

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 4321
```

## Verification

```sh
npm run check
npm run build
npm run test
```

The built-output tests require a default preview build (`PUBLIC_INDEXABLE` unset); run them **before** rebuilding for production. They check identity/metadata, all local anchors and asset links, responsive portrait markup, crawler policy, and absence of service-sales/private career copy. They do not certify WCAG compliance, measure Core Web Vitals, or replace responsive browser testing.

## Content and design

- `src/pages/index.astro`: homepage and explicitly framed personal principles/interests.
- `src/layouts/BaseLayout.astro`: metadata, JSON-LD, self-hosted fonts, page shell.
- `src/styles/global.css`: white/charcoal/vermilion editorial design tokens, layout, responsive rules, focus states, reduced motion.
- `src/assets/carlos-campos-neutral.png`: portrait used by the page; Astro generates responsive WebP assets. The other supplied portrait assets are retained.
- `public/social-card.png`: 1200×630 sharing graphic.

The text-led hero uses white `#FFFFFF`, charcoal `#171717`, vermilion `#C43B23`, and a neutral secondary surface `#F2F2F2`. The portrait appears in About rather than the hero.

Public copy is neutral Spanish. Code and maintenance documentation are English. Only supplied professional context is used: EDUCA EDTECH Group, development, architecture, team coordination, and the technologies named in the source. There are no invented employment dates, impact metrics, formal Tech Lead title, projects, or articles. Historic Drupal technology experience is retained; no current Drupal community involvement is implied. LinkedIn may require authentication.

Contact uses the supplied LinkedIn URL; GitHub uses the verified public account. No unverified inbox, nonfunctional form, cookies, analytics, or remote runtime font requests are included.

DM Sans and Source Serif 4 are self-hosted through Fontsource packages under SIL Open Font License 1.1; license copies are in `public/licenses/`. Fallbacks: Arial and Georgia. No UI framework or client application script is shipped.

## Indexing and deployment

Preview builds are **noindex, nofollow** and `robots.txt` disallows crawling by default. This is not access control: use private hosting for confidential previews. This project contains only intended public content.

Create an indexable release explicitly after running the verification commands above:

```sh
PUBLIC_INDEXABLE=true npm run build
npm run preview
```

That release allows crawling and advertises the sitemap. The canonical domain is `https://carloscampos.cloud/`; changing it requires updating `astro.config.mjs`, `src/layouts/BaseLayout.astro`, both crawler endpoints, and the tests together.

Follow the [VPS deployment guide](docs/deployment.md) to serve **only `dist/`** through Nginx with HTTPS, release directories, and rollback. The static server needs no Node.js, PM2, Docker, database, or repository credentials. `npm run preview` is for local inspection, not a public production server. No VPS or DNS changes are performed by these instructions.

## Public repository hygiene

Commit source, assets, tests, documentation, and `package-lock.json`. `.gitignore` excludes dependencies, generated output, environment/credential files, and local agent/editor metadata. Never put secrets in `public/` or `PUBLIC_*` variables: those can become public build output. `private: true` in `package.json` prevents accidental npm publishing; it does not control GitHub visibility. A public repository does not by itself grant a software license; the bundled font licenses apply to those fonts only.
