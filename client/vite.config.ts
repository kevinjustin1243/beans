import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss()
  ],
  server: {
    host: true,                          // listen on 0.0.0.0 (LAN/VPN reachable)
    proxy: {
      '/api':    'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
})
