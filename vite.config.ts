import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/earth-moon-sun-app/',
  server: {
    port: 5173
  }
});