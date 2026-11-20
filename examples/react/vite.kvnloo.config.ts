import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist/kvnloo',
    rollupOptions: { input: fileURLToPath(new URL('./kvnloo.html', import.meta.url)) },
  },
});
