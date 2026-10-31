import { products, type Product } from "./catalog";

export interface CartEntry {
  id: string;
  quantity: number;
}
export const CART_KEY = "xtbang.cart.v1";

export function parseCart(saved: string | null, catalog: Product[] = products): CartEntry[] {
  let value: unknown;
  try {
    value = JSON.parse(saved || "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];
  const quantities = new Map<string, number>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const { id, quantity } = entry as Partial<CartEntry>;
    if (
      typeof id !== "string" || typeof quantity !== "number" ||
      !Number.isSafeInteger(quantity) || quantity <= 0 ||
      !catalog.some(product => product.id === id)
    ) continue;
    const combined = (quantities.get(id) || 0) + quantity;
    if (Number.isSafeInteger(combined)) quantities.set(id, combined);
  }
  return [...quantities].map(([id, quantity]) => ({ id, quantity }));
}

export function setCartQuantity(
  cart: CartEntry[], id: string, quantity: number, catalog: Product[] = products,
): CartEntry[] {
  const product = catalog.find(item => item.id === id);
  const current = cart.find(item => item.id === id)?.quantity || 0;
  if (
    !product || !Number.isSafeInteger(quantity) || quantity < 0 ||
    (!product.inStock && quantity > current)
  ) return cart;
  if (quantity === 0) return cart.filter(item => item.id !== id);
  return current
    ? cart.map(item => item.id === id ? { id, quantity } : item)
    : [...cart, { id, quantity }];
}

export function addCartItem(cart: CartEntry[], id: string, catalog: Product[] = products) {
  return setCartQuantity(cart, id, (cart.find(item => item.id === id)?.quantity || 0) + 1, catalog);
}

export function summarizeCart(cart: CartEntry[], catalog: Product[] = products) {
  const items = cart.map(entry => ({
    ...entry,
    product: catalog.find(product => product.id === entry.id)!,
  }));
  return {
    items,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    total: items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
  };
}
