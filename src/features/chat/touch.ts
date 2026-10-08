export const LONG_PRESS_MS = 450;
export const LONG_PRESS_SLOP_PX = 10;

type Point = { x: number; y: number };
export const movedBeyond = (from: Point, to: Point, px: number) => Math.hypot(to.x - from.x, to.y - from.y) > px;

type Snapshot = { lastId: string | undefined; count: number };
/** An older-page load is only a "prepend" when the newest message is unchanged and the list grew. */
export const shouldRestore = (req: Snapshot, now: Snapshot) => req.lastId === now.lastId && now.count > req.count;
