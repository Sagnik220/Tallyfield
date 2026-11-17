/**
 * Headline sizes that adapt to how long the headline is.
 * The design's big poster type works for short headlines ("Which Santos should you buy?");
 * a full sentence at that size fills the screen, so longer headlines step down.
 */
type Tier = 'hero' | 'article' | 'card' | 'row' | 'tile'

const STEPS: Record<Tier, [number, string][]> = {
  // [max characters, font-size]
  hero: [
    [28, 'clamp(52px, 6.4vw, 96px)'],
    [50, 'clamp(42px, 4.6vw, 68px)'],
    [Infinity, 'clamp(32px, 3.2vw, 48px)'],
  ],
  article: [
    [28, 'clamp(52px, 6.6vw, 100px)'],
    [55, 'clamp(42px, 4.8vw, 72px)'],
    [Infinity, 'clamp(32px, 3.4vw, 52px)'],
  ],
  card: [
    [28, '38px'],
    [50, '30px'],
    [Infinity, '24px'],
  ],
  row: [
    [45, 'clamp(26px, 2.8vw, 40px)'],
    [Infinity, 'clamp(20px, 2vw, 28px)'],
  ],
  tile: [
    [36, '28px'],
    [Infinity, '22px'],
  ],
}

export function titleSize(title: string, tier: Tier): string {
  const length = title.trim().length
  return STEPS[tier].find(([max]) => length <= max)![1]
}
