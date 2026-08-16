import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom", "@supabase/supabase-js"],
    exclude: ["lucide-react"],
  },
  build: {
    target: "es2015", // Support older browsers including iOS Safari
    minify: "terser",
    terserOptions: {
      safari10: true, // Special handling for Safari 10+
    },
  },
  server: {
    hmr: {
      overlay: true,
    },
  },
});
