import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
    host: '127.0.0.1',
    // Один origin для клиента и API — refresh-cookie работает без CORS-сложностей
    proxy: { '/api': 'http://localhost:4100' },
  },
});
