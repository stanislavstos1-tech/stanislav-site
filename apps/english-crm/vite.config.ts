import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Статическая сборка для GitHub Pages: относительные пути, результат в /english-crm
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: { outDir: '../../english-crm', emptyOutDir: true, chunkSizeWarningLimit: 700 },
});
