// Composition root placeholder: the engine PR replaces it with the bootstrap that creates the
// adapters, injects them through the ports and starts the frame loop.
if (document.querySelector<HTMLCanvasElement>('#screen') === null) {
  throw new Error('Canvas #screen is missing from index.html');
}
