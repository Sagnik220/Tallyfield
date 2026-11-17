/**
 * Headline sizes that adapt to how long the headline is.
 * The design's big poster type works for short headlines ("Which Santos should you buy?");
 * a full sentence at that size fills the screen, so longer headlines step down.
 */
type Tier = 'hero' | 'article' | 'read' | 'card' | 'row' | 'tile'

const STEPS: Record<Tier, [number, string][]> = {
  // [max characters, font-size]. Minimums are phone sizes, maximums are large-monitor sizes.
  hero: [
    [28, 'clamp(36px, 5.4vw, 80px)'],
    [50, 'clamp(30px, 3.8vw, 56px)'],
    [Infinity, 'clamp(24px, 2.7vw, 40px)'],
  ],
  article: [
    [28, 'clamp(38px, 5.6vw, 84px)'],
    [55, 'clamp(30px, 4vw, 60px)'],
    [Infinity, 'clamp(25px, 2.9vw, 44px)'],
  ],
  // Article headline inside the ~700px reading column.
  read: [
    [28, 'clamp(40px, 5.4vw, 68px)'],
    [55, 'clamp(32px, 4.3vw, 56px)'],
    [Infinity, 'clamp(27px, 3.4vw, 44px)'],
  ],
  card: [
    [28, 'clamp(26px, 2.6vw, 34px)'],
    [50, 'clamp(22px, 2.1vw, 28px)'],
    [Infinity, 'clamp(18px, 1.7vw, 22px)'],
  ],
  row: [
    [45, 'clamp(20px, 2.4vw, 34px)'],
    [Infinity, 'clamp(17px, 1.8vw, 26px)'],
  ],
  tile: [
    [36, 'clamp(20px, 2vw, 26px)'],
    [Infinity, 'clamp(17px, 1.6vw, 21px)'],
  ],
}

export function titleSize(title: string, tier: Tier): string {
  const length = title.trim().length
  return STEPS[tier].find(([max]) => length <= max)![1]
}
