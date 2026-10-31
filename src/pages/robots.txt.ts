export function GET() {
  const indexable = import.meta.env.PUBLIC_INDEXABLE === 'true';
  const body = indexable
    ? 'User-agent: *\nAllow: /\nSitemap: https://carloscampos.cloud/sitemap.xml\n'
    : 'User-agent: *\nDisallow: /\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
