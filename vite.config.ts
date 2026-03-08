import path from "path"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/graph': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/obo-file-upload': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
