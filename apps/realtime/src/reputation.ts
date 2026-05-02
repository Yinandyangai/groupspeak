export const MAX_VIBE_SCORE = 100;
export const MIN_VIBE_SCORE = 0;

// basic placeholder logic so server doesn't crash
export function clampVibeScore(score: number) {
  if (score > MAX_VIBE_SCORE) return MAX_VIBE_SCORE;
  if (score < MIN_VIBE_SCORE) return MIN_VIBE_SCORE;
  return score;
}
