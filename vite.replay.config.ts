import { defineConfig } from 'vite';

// The verifier's headless replay: one dependency-free ES module for Node (ADR-0031 decision 22).
export default defineConfig({
  build: {
    ssr: true,
    target: 'node22',
    // The game's public files (`_headers`, assets) are not part of the CLI.
    copyPublicDir: false,
    outDir: 'dist-replay',
    emptyOutDir: true,
    lib: { entry: 'src/replay/cli.ts', formats: ['es'], fileName: () => 'replay.mjs' },
    // An SSR build names the entry itself: the bundle keeps the ADR's file name.
    rollupOptions: { output: { entryFileNames: 'replay.mjs' } },
  },
});
