import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Статическая сборка для GitHub Pages: относительные пути, результат в /srez-crm
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: { outDir: '../../srez-crm', emptyOutDir: true, chunkSizeWarningLimit: 700 },
});
