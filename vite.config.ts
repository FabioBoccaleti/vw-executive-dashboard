import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, PluginOption } from "vite";

import sparkPlugin from "@github/spark/spark-vite-plugin";
import createIconImportProxy from "@github/spark/vitePhosphorIconProxyPlugin";
import { resolve } from 'path'

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // DO NOT REMOVE
    createIconImportProxy() as PluginOption,
    sparkPlugin() as PluginOption,
  ],
  server: {
    port: 5000,
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // Divide dependências pesadas em chunks separados para reduzir o pico
        // de memória do build (evita OOM no build da Vercel) e o tamanho do
        // chunk principal.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return;
          if (id.includes('pdfjs-dist')) return 'vendor-pdfjs';
          if (id.includes('tesseract.js')) return 'vendor-tesseract';
          if (id.includes('exceljs') || id.includes('xlsx')) return 'vendor-spreadsheet';
          if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('dom-to-image')) return 'vendor-export';
          if (id.includes('three')) return 'vendor-three';
          if (id.includes('recharts') || id.includes('/d3-') || id.includes('/d3/')) return 'vendor-charts';
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('@radix-ui')) return 'vendor-radix';
          return 'vendor';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src')
    }
  },
});
