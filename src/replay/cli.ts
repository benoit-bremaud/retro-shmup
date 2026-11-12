import { DECODE, MAX_INPUT_BYTES, replayRequest } from './replay-request';

/**
 * The headless replay for the leaderboard verifier (ADR-0031 decision 22): one JSON document
 * `{ seed, codec, frames, inputs }` on stdin, one JSON line on stdout, exit code 0 either way.
 */

/** Reads stdin up to the cap; past it the request is `decode`. */
function readStdin(): Promise<string | undefined> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    process.stdin.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_INPUT_BYTES) {
        process.stdin.destroy();
        resolve(undefined);
        return;
      }
      chunks.push(chunk);
    });
    process.stdin.on('error', () => {
      resolve(undefined);
    });
    process.stdin.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
  });
}

/** The process entry: always one JSON line and exit code 0. */
async function main(): Promise<void> {
  const text = await readStdin();
  const report = text === undefined ? DECODE : replayRequest(text);
  process.stdout.write(`${JSON.stringify(report)}\n`);
}

await main();
