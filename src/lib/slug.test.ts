import { describe, expect, it } from 'vitest'
import { slugify } from './slug'

describe('slugify()', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Ban Dalam')).toBe('ban-dalam')
    expect(slugify('Biaya  Marketplace')).toBe('biaya-marketplace')
  })

  it('strips accents rather than dropping the letter', () => {
    expect(slugify('Sérvis Mesin')).toBe('servis-mesin')
  })

  it('removes punctuation and symbols', () => {
    expect(slugify('Oli & Filter (Rutin)')).toBe('oli-filter-rutin')
  })

  it('does not leave leading or trailing hyphens', () => {
    expect(slugify('  --Rem--  ')).toBe('rem')
    expect(slugify('!!!')).toBe('')
  })

  it('truncates without leaving a trailing hyphen', () => {
    // A cut landing on a separator would otherwise produce "…-".
    const long = `${'a'.repeat(49)} tail`
    const slug = slugify(long)
    expect(slug.length).toBeLessThanOrEqual(50)
    expect(slug.endsWith('-')).toBe(false)
  })

  it('returns empty for input with no usable characters', () => {
    expect(slugify('')).toBe('')
    expect(slugify('   ')).toBe('')
  })

  it('keeps digits, which real category names use', () => {
    expect(slugify('Ban 14 inci')).toBe('ban-14-inci')
  })
})
