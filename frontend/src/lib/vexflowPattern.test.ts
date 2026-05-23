import { describe, expect, it } from 'vitest'
import { vexDuration } from './vexflowPattern'

describe('vexDuration', () => {
  it('maps notes to VexFlow duration codes', () => {
    expect(vexDuration({ type: 'note', duration: 'q' })).toBe('q')
    expect(vexDuration({ type: 'note', duration: '8' })).toBe('8')
    expect(vexDuration({ type: 'note', duration: 'w' })).toBe('w')
  })

  it('marks rests with an r suffix', () => {
    expect(vexDuration({ type: 'rest', duration: 'q' })).toBe('qr')
    expect(vexDuration({ type: 'rest', duration: '16' })).toBe('16r')
  })

  it('marks dotted values with a d', () => {
    expect(vexDuration({ type: 'note', duration: 'q', dots: 1 })).toBe('qd')
    expect(vexDuration({ type: 'rest', duration: 'h', dots: 1 })).toBe('hdr')
  })
})
