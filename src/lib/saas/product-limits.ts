export function isProductLimitReached(
  productCount: number,
  productLimit: number
) {
  return productLimit <= 0 || productCount >= productLimit;
}

export function productSlotsRemaining(
  productCount: number,
  productLimit: number
) {
  return Math.max(productLimit - productCount, 0);
}
