/** The server rejects a second review of the same card within 2 s (migration 0007); keep a margin over that. */
export const REVIEW_GAP_MS = 2_100;

/** How long a card's next write must wait, given when its previous write finished. */
export function reviewDelayMs(lastDoneAt: number | undefined, now: number, gapMs = REVIEW_GAP_MS): number {
  return lastDoneAt === undefined ? 0 : Math.max(0, lastDoneAt + gapMs - now);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Serialises review writes per card so an "Again" card that comes straight back is never written twice inside the
 * server's repeat window. Writes for different cards run independently; `flush` waits for all of them.
 */
export function createReviewWriter(onError: (err: unknown) => void) {
  const chains = new Map<string, Promise<number | undefined>>();
  return {
    enqueue(cardId: string, write: () => Promise<void>): void {
      const prev = chains.get(cardId) ?? Promise.resolve(undefined);
      chains.set(cardId, prev.then(async (lastDoneAt) => {
        const wait = reviewDelayMs(lastDoneAt, Date.now());
        if (wait > 0) await sleep(wait);
        try { await write(); } catch (err) { onError(err); }
        return Date.now();
      }));
    },
    async flush(): Promise<void> {
      await Promise.all(chains.values());
    },
  };
}
