import { build } from 'vite';

/**
 * The domain replayer bundled in memory as a classic script defining `retroReplay` (ADR-0031
 * decision 11): the smoke test injects it into each engine, so nothing test-only ships in `dist`.
 * Same source, bundler and target as the game.
 */
export async function replayerBundle(): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      target: 'es2022',
      minify: false,
      copyPublicDir: false,
      lib: { entry: 'src/domain/replay/replayer.ts', formats: ['iife'], name: 'retroReplay' },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  const first = outputs[0];
  const chunk = first !== undefined && 'output' in first ? first.output[0] : undefined;
  if (chunk === undefined) throw new Error('The replayer bundle is empty');
  return chunk.code;
}
