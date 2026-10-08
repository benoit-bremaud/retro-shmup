// Composition root placeholder: the engine (vertical slice PR B) replaces this with the bootstrap
// that creates the adapters, injects them through the ports and starts the frame loop.
export const canvas = document.querySelector<HTMLCanvasElement>('#screen');
if (canvas === null) {
  throw new Error('Canvas #screen is missing from index.html');
}
