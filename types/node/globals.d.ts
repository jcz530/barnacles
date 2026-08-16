// `src/shared` runs in both the renderer and Node (CLI/main). Code there
// branches on `typeof window !== 'undefined'` to pick an implementation, so the
// node-side project needs the name declared without pulling in the whole DOM
// lib. Only included by tsconfig.node.json -- the renderer gets the real
// `window` from lib.dom.
declare const window: unknown;
