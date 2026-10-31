import { describe, expect, it } from "vitest";
import { addCartItem, parseCart, setCartQuantity, summarizeCart } from "../../src/client/features/shop/cart";
import { filterProducts, money, type Product } from "../../src/client/features/shop/catalog";

const catalog: Product[] = [
  { id: "a", name: "Band 钥匙扣", description: "", category: "钥匙扣", price: 5.21, image: "", inStock: true },
  { id: "b", name: "贴纸", description: "", category: "贴纸", price: 2.5, image: "", inStock: true },
  { id: "sold", name: "售罄商品", description: "", category: "钥匙扣", price: 8, image: "", inStock: false },
];

describe("cart persistence boundary", () => {
  it.each([null, "", "{broken", "null", "{}", "42"])("treats unusable saved content as an empty cart: %s", value => {
    expect(parseCart(value, catalog)).toEqual([]);
  });
  it("keeps valid known products, merges duplicates and rejects invalid quantities", () => {
    const saved = JSON.stringify([null, 1, {}, { id: "missing", quantity: 1 }, { id: "a", quantity: "3" }, { id: "a", quantity: -1 }, { id: "a", quantity: 0 }, { id: "a", quantity: 1.5 }, { id: "a", quantity: 2 }, { id: "a", quantity: 3 }, { id: "a", quantity: Number.MAX_SAFE_INTEGER }, { id: "b", quantity: Number.MAX_SAFE_INTEGER + 1 }, { id: "sold", quantity: 1 }]);
    expect(parseCart(saved, catalog)).toEqual([{ id: "a", quantity: 5 }, { id: "sold", quantity: 1 }]);
  });
});

describe("cart quantity and stock rules", () => {
  it("adds, increments, changes and removes items without mutating the original cart", () => {
    const original = [{ id: "a", quantity: 1 }];
    const added = addCartItem(original, "a", catalog);
    expect(added).toEqual([{ id: "a", quantity: 2 }]);
    expect(original).toEqual([{ id: "a", quantity: 1 }]);
    expect(addCartItem(added, "b", catalog)).toEqual([...added, { id: "b", quantity: 1 }]);
    expect(setCartQuantity(added, "a", 4, catalog)).toEqual([{ id: "a", quantity: 4 }]);
    expect(setCartQuantity(added, "a", 0, catalog)).toEqual([]);
  });
  it("does not add unknown, sold-out or overflowing quantities", () => {
    expect(addCartItem([], "missing", catalog)).toEqual([]);
    expect(addCartItem([], "sold", catalog)).toEqual([]);
    const full = [{ id: "a", quantity: Number.MAX_SAFE_INTEGER }];
    expect(addCartItem(full, "a", catalog)).toBe(full);
    for (const quantity of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(setCartQuantity(full, "a", quantity, catalog)).toBe(full);
    }
  });
  it("retains sold-out saved items but permits only reducing or removing them", () => {
    const saved = [{ id: "sold", quantity: 3 }];
    expect(addCartItem(saved, "sold", catalog)).toBe(saved);
    expect(setCartQuantity(saved, "sold", 2, catalog)).toEqual([{ id: "sold", quantity: 2 }]);
    expect(setCartQuantity(saved, "sold", 0, catalog)).toEqual([]);
  });
  it("calculates quantities and monetary totals from the catalog", () => {
    const summary = summarizeCart([{ id: "a", quantity: 2 }, { id: "b", quantity: 3 }], catalog);
    expect(summary.count).toBe(5);
    expect(summary.total).toBeCloseTo(17.92);
    expect(summary.items[0].product).toEqual(catalog[0]);
    expect(money(summary.total)).toBe("¥17.92");
    expect(summarizeCart([], catalog)).toEqual({ items: [], count: 0, total: 0 });
  });
});

it("combines trimmed case-insensitive searches and exact categories", () => {
  expect(filterProducts(" BAND ", "全部", catalog)).toEqual([catalog[0]]);
  expect(filterProducts("", "贴纸", catalog)).toEqual([catalog[1]]);
  expect(filterProducts("Band", "贴纸", catalog)).toEqual([]);
  expect(filterProducts("不存在", "全部", catalog)).toEqual([]);
});
