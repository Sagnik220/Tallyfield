/** "2,214 / 50,000 characters" under a long text box; turns amber near the limit. */
export function CharCount({ id, length, max }: { id?: string; length: number; max: number }) {
  const near = length >= max * 0.9
  return (
    <span id={id} className="tf-note" aria-live={near ? 'polite' : 'off'} style={{ display: 'block', marginTop: 6, fontSize: 12, textAlign: 'right', color: near ? 'var(--warn)' : undefined, fontVariantNumeric: 'tabular-nums' }}>
      {length.toLocaleString('en-IN')} / {max.toLocaleString('en-IN')} characters
    </span>
  )
}
