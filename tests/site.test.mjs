import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../dist/', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const read = (file) => readFile(new URL(file, root), 'utf8');

test('identity and metadata describe a personal engineering brand', () => {
  assert.match(html, /<html[^>]*lang="es"/);
  assert.match(html, /<title>Carlos Campos — Ingeniería, liderazgo técnico y producto<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/carloscampos\.cloud\/"/);
  assert.match(html, /name="description" content="Soy Carlos Campos/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  const match = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
  assert.ok(match);
  const person = JSON.parse(match[1]);
  assert.equal(person['@type'], 'Person');
  assert.equal(person.name, 'Carlos Campos Fuentes');
  assert.equal(person.worksFor.name, 'EDUCA EDTECH Group');
  assert.equal(person.jobTitle, undefined);
});

test('all internal links and anchor targets resolve', async () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, new Set(ids).size, 'IDs must be unique');
  for (const [, href] of html.matchAll(/\bhref="([^"]+)"/g)) {
    if (href.startsWith('#')) assert.ok(ids.includes(href.slice(1)), `Missing anchor ${href}`);
    else if (href.startsWith('/')) await access(new URL(href.slice(1), root));
  }
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.match(html, /class="skip-link" href="#contenido"/);
});

test('local portrait is optimized with dimensions and responsive sources', async () => {
  const image = html.match(/<img[^>]+alt="Retrato de Carlos Campos"[^>]*>/)?.[0];
  assert.ok(image);
  assert.match(image, /width="480"/);
  assert.match(image, /height="520"/);
  assert.match(image, /srcset="/);
  assert.match(image, /loading="lazy"/);
  const source = image.match(/\bsrc="([^"]+)"/)?.[1];
  assert.ok(source?.endsWith('.webp'));
  await access(new URL(source.slice(1), root));
});

test('portrait is in About rather than the text-led hero', () => {
  const hero = html.match(/<section[^>]+id="inicio"[^>]*>(.*?)<\/section>/s)?.[1];
  const about = html.match(/<section[^>]+id="sobre-mi"[^>]*>(.*?)<\/section>/s)?.[1];
  assert.ok(hero);
  assert.ok(about);
  assert.doesNotMatch(hero, /<img\b/);
  assert.match(about, /alt="Retrato de Carlos Campos"/);
  assert.equal((html.match(/alt="Retrato de Carlos Campos"/g) ?? []).length, 1);
});

test('About follows narrative with one responsive professional profile and LinkedIn', async () => {
  const about = html.match(/<section[^>]+id="sobre-mi"[^>]*>(.*?)<\/section>/s)?.[1];
  assert.ok(about);
  assert.match(about, /id="about-title"[\s\S]*class="about-narrative"[\s\S]*class="context-note"[\s\S]*class="profile-summary"[\s\S]*class="about-portrait"[\s\S]*class="current-work"/);
  assert.match(about, /class="current-work">[\s\S]*Mi trabajo hoy[\s\S]*EDTECH Group[\s\S]*liderazgo técnico\.[\s\S]*<\/div>\s*<\/div>\s*<a class="text-link"[^>]*><span class="link-label">Mi trayectoria en LinkedIn/);
  const css = await readFile(new URL('../src/styles/global.css', import.meta.url), 'utf8');
  const mobile = css.split('@media (max-width: 700px) {')[1];
  assert.ok(mobile);
  assert.match(css, /\.hero-bottom \{[^}]*margin-top: 96px/);
  assert.match(mobile, /\.hero-bottom \{[^}]*margin-top: 40px/);
  assert.match(css, /\.profile-summary \{ display: grid; gap: 28px;/);
  assert.match(css, /\.about-portrait \{ width: min\(100%, 220px\)/);
  assert.match(mobile, /\.context-note \{ padding-left: 0; border-left: 0;/);
  assert.match(mobile, /\.about-narrative, \.context-note \{ text-align: left;/);
  assert.match(mobile, /\.about-columns \{ grid-template-columns: 1fr; gap: 40px;/);
  assert.match(mobile, /\.profile-summary \{ --profile-photo-size: clamp\(96px, 28vw, 112px\); grid-template-columns: var\(--profile-photo-size\) minmax\(0, 1fr\); align-items: start; gap: 32px;/);
  assert.match(mobile, /\.about-portrait \{ width: var\(--profile-photo-size\); margin: 0;/);
  assert.match(about, /sizes="\(max-width: 342px\) 96px, \(max-width: 400px\) 28vw, \(max-width: 700px\) 112px, 220px"/);
  assert.match(mobile, /\.about-portrait figcaption \{ display: none;/);
  assert.doesNotMatch(css, /\.current-work\s*\{[^}]*display:\s*none|display:\s*contents/);
});

test('hero actions keep the primary CTA first and socials together on mobile', async () => {
  const hero = html.match(/<section[^>]+id="inicio"[^>]*>(.*?)<\/section>/s)?.[1];
  assert.ok(hero);
  const actions = hero.match(/<div class="hero-links">\s*(<a[^>]+class="solid-link"[^>]*>.*?<\/a>)\s*<div class="hero-social-links">(.*?)<\/div>\s*<\/div>/s);
  assert.ok(actions, 'Primary CTA precedes a dedicated social group in focus order');
  assert.match(actions[1], /href="#sobre-mi"/);
  const socialHrefs = [...actions[2].matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(socialHrefs, ['https://github.com/camtes', 'https://www.linkedin.com/in/carloscamposfuentes/']);
  const css = await readFile(new URL('../src/styles/global.css', import.meta.url), 'utf8');
  const mobile = css.split('@media (max-width: 700px) {')[1];
  assert.match(css, /\.hero-links \{ display: flex; gap: 30px; align-items: center;/);
  assert.match(css, /\.hero-social-links \{ display: flex; align-items: center; gap: 30px;/);
  assert.match(mobile, /\.hero-links \{ flex-direction: column; align-items: flex-start; gap: 20px;/);
  assert.match(mobile, /\.hero-social-links \{ flex-wrap: nowrap; gap: 22px;/);
});

test('hero social links have separate visible labels and decorative arrows', () => {
  const hero = html.match(/<section[^>]+id="inicio"[^>]*>(.*?)<\/section>/s)?.[1];
  assert.ok(hero);
  for (const [url, label] of [
    ['https://github.com/camtes', 'Mi GitHub'],
    ['https://www.linkedin.com/in/carloscamposfuentes/', 'Mi LinkedIn'],
  ]) {
    const link = [...hero.matchAll(/<a\b([^>]*)>(.*?)<\/a>/gs)]
      .find(([, attributes]) => attributes.includes(`href="${url}"`));
    assert.ok(link, `Missing hero link: ${label}`);
    assert.match(link[1], /target="_blank"/);
    assert.match(link[1], /rel="noopener noreferrer"/);
    assert.ok(link[2].includes(`<span class="link-label">${label}</span>`));
    assert.match(link[2], /<span aria-hidden="true">↗<\/span>/);
    assert.match(link[2], /class="sr-only"/);
  }
});

test('all arrow-bearing text links underline only their visible label', async () => {
  const links = [...html.matchAll(/<a\b([^>]*)>(.*?)<\/a>/gs)]
    .filter(([, attributes, contents]) => contents.includes('↗') && !attributes.includes('solid-link'));
  assert.equal(links.length, 5, 'Header, two hero socials, About and footer use the shared pattern');
  for (const [, attributes, contents] of links) {
    assert.match(attributes, /class="(?:text-link|header-contact|footer-link)"/);
    assert.match(contents, /^<span class="link-label">[^<]+<\/span><span aria-hidden="true">↗<\/span>/);
    if (attributes.includes('target="_blank"')) {
      assert.match(attributes, /rel="noopener noreferrer"/);
      assert.match(contents, /<span class="sr-only"> \(abre en otra pestaña\)<\/span>/);
    }
  }
  const css = await readFile(new URL('../src/styles/global.css', import.meta.url), 'utf8');
  assert.match(css, /\.text-link, \.header-contact, \.footer-link \{[^}]*gap: 8px; text-decoration: none;/);
  assert.match(css, /\.link-label \{ text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 5px;/);
  assert.doesNotMatch(css, /hero-link-label|\.header-contact \{[^}]*border-bottom/);
  assert.match(css, /a:focus-visible \{ outline: 2px solid var\(--accent\)/);
});

function normalizeHex(value) {
  const hex = value.trim().toLowerCase();
  return hex.length === 4 ? `#${[...hex.slice(1)].map((digit) => digit + digit).join('')}` : hex;
}

function luminance(hex) {
  const normalized = normalizeHex(hex);
  const channels = [1, 3, 5].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('built palette matches approved colors and actual text pairs meet 4.5:1', async () => {
  const stylesheet = html.match(/href="([^\"]+\.css)"/)?.[1];
  assert.ok(stylesheet);
  const css = await read(stylesheet.slice(1));
  const token = (name) => normalizeHex(css.match(new RegExp(`--${name}:([^;}]+)`))?.[1] ?? '');
  assert.equal(token('paper'), '#ffffff');
  assert.equal(token('ink'), '#171717');
  assert.equal(token('accent'), '#c43b23');
  assert.equal(token('tint'), '#f2f2f2');
  for (const [foreground, background] of [
    ['ink', 'paper'], ['ink', 'tint'], ['muted', 'paper'], ['muted', 'tint'],
    ['accent', 'paper'], ['accent', 'tint'], ['paper', 'ink'], ['paper', 'accent'],
  ]) {
    const ratio = contrast(token(foreground), token(background));
    assert.ok(ratio >= 4.5, `${foreground}/${background}: ${ratio.toFixed(2)}:1`);
  }
  assert.doesNotMatch(css, /#(?:375c49|202c27|f7f5f0|e9ede5|29463f|d1dfca|505b51)\b/i);
  assert.match(html, /name="theme-color" content="#ffffff"/);
  const favicon = await read('favicon.svg');
  assert.match(favicon, /#c43b23/);
});

test('hero avoids repeated introduction and interests retain shared intrinsic rows', async () => {
  const hero = html.match(/<section[^>]+id="inicio"[^>]*>(.*?)<\/section>/s)?.[1];
  assert.ok(hero);
  assert.doesNotMatch(hero, /Soy Carlos Campos|class="eyebrow"/);
  assert.match(hero, /Entre el código,/);
  assert.match(hero, /Ingeniería de software y liderazgo técnico/);
  const interests = html.match(/<div class="interests">(.*?)<\/div>/s)?.[1];
  assert.ok(interests);
  const articles = [...interests.matchAll(/<article>(.*?)<\/article>/gs)];
  assert.equal(articles.length, 3);
  for (const [, article] of articles) {
    assert.match(article, /class="interest-number"[\s\S]*<h3>[\s\S]*<p>[\s\S]*class="interest-note"/);
  }
  const stylesheet = html.match(/href="([^\"]+\.css)"/)?.[1];
  assert.ok(stylesheet);
  const css = await read(stylesheet.slice(1));
  assert.match(css, /grid-template-rows:subgrid/);
  assert.match(css, /grid-row:span 4/);
});

test('public copy avoids service sales and confidential career deliberations', () => {
  for (const phrase of ['Tech Lead externo', 'Solicitar una auditoría', 'Ver servicios', 'cambio de empresa', 'busco empleo', 'CTO externo', '546 seguidores', '500 contactos']) {
    assert.ok(!html.toLowerCase().includes(phrase.toLowerCase()), `Unexpected copy: ${phrase}`);
  }
  assert.ok(!html.includes('<form'));
  assert.match(html, /https:\/\/www\.linkedin\.com\/in\/carloscamposfuentes\//);
  assert.match(html, /https:\/\/github\.com\/camtes/);
  assert.ok(!html.includes('mailto:'));
});

test('public copy does not imply current Drupal community involvement', () => {
  assert.doesNotMatch(html, /drupalcamp|compartiendo y aprendiendo en comunidad/i);
  assert.match(html, /Mi experiencia incluye React, React Native, Drupal y entornos cloud/);
});

test('preview crawler policy and production sitemap are present', async () => {
  assert.equal(await read('robots.txt'), 'User-agent: *\nDisallow: /\n');
  assert.match(await read('sitemap.xml'), /<loc>https:\/\/carloscampos\.cloud\/<\/loc>/);
  await access(new URL('favicon.svg', root));
  await access(new URL('social-card.png', root));
});

test('no application runtime scripts or third-party font requests', () => {
  const scripts = [...html.matchAll(/<script([^>]*)>/g)].map((match) => match[1]);
  assert.ok(scripts.every((attributes) => attributes.includes('application/ld+json')));
  assert.ok(!html.includes('fonts.googleapis.com'));
});
