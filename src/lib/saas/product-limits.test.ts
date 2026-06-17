import { describe, expect, it } from 'vitest';

import { isProductLimitReached, productSlotsRemaining } from './product-limits';

describe('isProductLimitReached', () => {
  it('blocks new products at or above the package limit', () => {
    expect(isProductLimitReached(20, 20)).toBe(true);
    expect(isProductLimitReached(21, 20)).toBe(true);
    expect(isProductLimitReached(19, 20)).toBe(false);
  });

  it('treats a zero limit as no product slots available', () => {
    expect(isProductLimitReached(0, 0)).toBe(true);
  });
});

describe('productSlotsRemaining', () => {
  it('returns remaining product slots without going below zero', () => {
    expect(productSlotsRemaining(12, 20)).toBe(8);
    expect(productSlotsRemaining(20, 20)).toBe(0);
    expect(productSlotsRemaining(30, 20)).toBe(0);
  });
});
