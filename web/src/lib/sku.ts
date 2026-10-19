import type { Product, Sku } from '../api/types'

/** The SKU whose options equal the selection, or undefined for an impossible combination. */
export function findSku(product: Product, selection: Record<string, string>): Sku | undefined {
  return product.skus.find((s) => product.specifications.every((spec) => s.selectedOptions[spec.name] === selection[spec.name]))
}

/** Default selection: the cheapest SKU, matching the backend's add-to-cart default. */
export function defaultSelection(product: Product): Record<string, string> {
  const cheapest = product.skus[0]
  return cheapest ? { ...cheapest.selectedOptions } : {}
}

/** Price label for one option when the product varies on a single dimension. */
export function optionPrice(product: Product, specName: string, option: string): string | null {
  if (product.specifications.length !== 1) return null
  return product.skus.find((s) => s.selectedOptions[specName] === option)?.price.display ?? null
}

export function isOptionAvailable(product: Product, selection: Record<string, string>, specName: string, option: string): boolean {
  const next = { ...selection, [specName]: option }
  const sku = findSku(product, next)
  return Boolean(sku && sku.availability === 'inStock')
}
