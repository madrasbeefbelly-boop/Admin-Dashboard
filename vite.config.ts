import { defineConfig, type PluginOption } from "vite";
import path from "path";

async function loadReactPlugin(): Promise<PluginOption> {
  try {
    const { default: react } = await import("@vitejs/plugin-react-swc");
    return react();
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("Failed to load native binding")) {
      throw error;
    }
    console.warn("SWC native binding unavailable. Using Vite's JSX transform.");
    return [];
  }
}

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  server: {
    host: "localhost",
    port: 8080,
    watch: { ignored: ["**/.postgres.local/**", "**/.wwebjs_auth/**", "**/.wwebjs_cache/**"] },
  },
  plugins: [await loadReactPlugin()],
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split React and React DOM into separate chunk
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          // Split UI library components
          "ui-vendor": [
            "@radix-ui/react-accordion",
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-avatar",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-label",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-separator",
            "@radix-ui/react-slot",
            "@radix-ui/react-switch",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-tooltip",
          ],
          // Split form libraries
          "form-vendor": ["react-hook-form", "@hookform/resolvers", "zod"],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
}));
