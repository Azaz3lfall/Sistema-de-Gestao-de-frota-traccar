import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'


export default defineConfig({
  plugins: [react()],
  server: {
    host: true, 
    proxy: {
      '/api': {
        target: 'http://localhost:3666',
        changeOrigin: true,
      }
    },
    
    allowedHosts: [
      'dep.rastreadorautoram.com.br',
      '.rastreadorautoram.com.br'
    ]
  }
})