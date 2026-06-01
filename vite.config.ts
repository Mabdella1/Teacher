import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// Generate and inject a dynamic version stamp with every compilation/publish
const buildDate = new Date();
const pad = (n: number) => String(n).padStart(2, '0');
const versionStamp = `${buildDate.getFullYear().toString().slice(-2)}${pad(buildDate.getMonth() + 1)}${pad(buildDate.getDate())}-${pad(buildDate.getHours())}${pad(buildDate.getMinutes())}`;
process.env.VITE_APP_VERSION = `1.3.${versionStamp}`;

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
