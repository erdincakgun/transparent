import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import path from "path"
import tailwindcss from "@tailwindcss/vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "vendor-supabase",
              test: /\/node_modules\/@supabase\//,
              priority: 1,
            },
            {
              name: "dashboard",
              test: /\/src\/(layouts\/dashboard|pages\/(settle-up|transactions|accounts|users))\.tsx$/,
            },
          ],
        },
      },
    },
  },
})
