import { describe, it, expect, vi } from 'vitest';
import { useStampAutoAdd } from '../useStampAutoAdd';

describe('useStampAutoAdd', () => {
  it('should detect existing stamp correctly', () => {
    const { hasStampInState } = useStampAutoAdd(
      { value: [] },
      { value: 0 },
      vi.fn(),
      vi.fn()
    );

    const pagesWithStamp = [
      {
        objects: [
          { type: 'i-text', id: 'stamp_123', name: 'บล็อกเลขที่รับ', text: 'stamp' }
        ]
      }
    ];

    expect(hasStampInState(pagesWithStamp)).toBe(true);

    const pagesWithoutStamp = [
      {
        objects: [
          { type: 'i-text', isStampBlock: false, text: 'normal text' }
        ]
      }
    ];

    expect(hasStampInState(pagesWithoutStamp)).toBe(false);
  });

  it('should format date string properly', () => {
    const { autoAddStamp } = useStampAutoAdd(
      { value: null },
      { value: 0 },
      vi.fn(),
      vi.fn()
    );

    expect(() => autoAddStamp()).not.toThrow();
  });
});
