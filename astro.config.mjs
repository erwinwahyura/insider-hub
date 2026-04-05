// @ts-check
import { defineConfig } from 'astro:config';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  site: 'https://insider-hub.pages.dev',
  // R2 bucket ready: data-md (archival only, not SSR)
});
