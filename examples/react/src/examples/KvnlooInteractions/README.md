# Patch Lab

Run `pnpm dev:react` and open `/examples/kvnloo-interactions`. Drag Signal to the matching input, Shift-click the wires or use **Select wires**, then click **Tie up**. Drag Scope or Monitor to move the floating edge’s attachment points.

- **MagneticConnectionLine** uses the same strict-mode `canConnect` policy as the drop resolver, including any handle-specific eligibility checks. Set `connectionRadius={0}` to keep native direct drops, and use `useMagneticTarget` and `magneticDrop` in `onConnectEnd` for valid nearby drops that React Flow did not commit. `MagneticSnap` draws the release ring at the resolved flow coordinate. React Flow does not expose a callback to replace its native nearest-handle search; the example does not need to change it.
- **BundleEdge** takes bundle membership via `edge.data.bundle`. Give members with the same source and target the same `tied` state and mark one as `leader` to draw the clamp. Keep the metadata when untying so the same edges can animate back. IDs and endpoints do not change.
- **FloatingEdge** projects each opposing node center onto the measured border. Pass `edge.data.borderRadius` to match rounded nodes. **FloatingConnectionLine** uses the same geometry during a drag.

The magnetic feel follows [mrblackstudio’s editor](https://x.com/mrblackstudio/status/2116825570252112336) and the measured halo and ring timings in fframestudio. The taste-skill film informs the clamp fade, path cinch and signal beads. The floating edge follows the measured-node approach from the digital-twin example, with nearest-point projection instead of center-ray intersection.

Run `pnpm --filter react-examples exec vite build --config vite.kvnloo.config.ts` for the standalone build. Copy `examples/react/dist/kvnloo/assets/` and serve `examples/react/dist/kvnloo/kvnloo.html` as `index.html` beside it. Assets use relative URLs.
