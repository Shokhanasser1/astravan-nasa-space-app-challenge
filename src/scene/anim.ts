/**
 * Scene-local animation state shared between parts and the rig, mutated inside useFrame (no React state per frame).
 * Never game state: nothing here is read by the engine, the reducer or the UI.
 */
export const camState = { inside: false };
export const launchState = { h: 0 };
/** Longest finger travel (px) of the current gesture: a drag that comes back to its start is still not a tap. */
export const gesture = { moved: 0 };
