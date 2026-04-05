// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  site: 'https://insider-hub.pages.dev',
  // R2 bucket ready: insider-hub-assets
  // For scaling >25MB Pages limit
});
