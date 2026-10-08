import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    // Relative by default: the same build runs at the Pages root and inside itch.io's player (ADR-0004).
    base: env.VITE_BASE_URL ?? './',
    build: { target: 'es2022', sourcemap: true },
  };
});
