import { RECORD_BYTES } from '../domain/replay/record';
import { toColumns } from '../domain/replay/record-columns';

/**
 * Run codec 1 in the browser (ADR-0031 decisions 5–7): the record columns, raw DEFLATE through
 * `CompressionStream`, base64url without padding. The Node codec decodes what it writes; both are
 * tested against the same golden vector.
 */
export async function encodeCodec1(records: Uint8Array, frames: number): Promise<string> {
  const columns = new Uint8Array(frames * RECORD_BYTES);
  toColumns(records, frames, columns);
  const stream = new Blob([columns]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  return toBase64Url(compressed);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCodePoint(bytes[i] ?? 0);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''); // '=' only pads the end
}
