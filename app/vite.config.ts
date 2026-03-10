import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    // @atomiqlabs/sdk uses Node's `global`; polyfill for browser
    global: "globalThis",
  },
  server: {
    proxy: {
      // Proxy mempool.space requests (used by Atomiq SDK)
      "/proxy/mempool": {
        target: "https://mempool.space",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/mempool/, ""),
      },
      // Proxy okx.com requests (used by Atomiq SDK)
      "/proxy/okx": {
        target: "https://www.okx.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/okx/, ""),
      },
      // Proxy price provider APIs (used by Atomiq SDK for token prices)
      "/proxy/binance": {
        target: "https://api.binance.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/binance/, ""),
      },
      "/proxy/coingecko": {
        target: "https://api.coingecko.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/coingecko/, ""),
      },
      "/proxy/coinpaprika": {
        target: "https://api.coinpaprika.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/coinpaprika/, ""),
      },
      "/proxy/kraken": {
        target: "https://api.kraken.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/kraken/, ""),
      },
    },
  },
});
