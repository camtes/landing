import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://carloscampos.cloud',
  output: 'static',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
});
