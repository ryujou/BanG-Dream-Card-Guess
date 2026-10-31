import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ShopPage } from "../../src/client/pages/Shop";
import { ProductPage } from "../../src/client/pages/Product";
import { CartPage } from "../../src/client/pages/Cart";
import { CheckoutPage } from "../../src/client/pages/Checkout";
import { products } from "../../src/client/features/shop/catalog";
import { CART_KEY } from "../../src/client/features/shop/cart";
import { useCart } from "../../src/client/features/shop/useCart";

const originalProducts = structuredClone(products);
beforeEach(() => { localStorage.clear(); products.splice(0, products.length, ...structuredClone(originalProducts)); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

function view(entry: string) {
  return render(<MemoryRouter initialEntries={[entry]}><Routes>
    <Route path="/shop" element={<ShopPage />} />
    <Route path="/shop/:id" element={<ProductPage />} />
    <Route path="/cart" element={<CartPage />} />
    <Route path="/checkout" element={<CheckoutPage />} />
  </Routes></MemoryRouter>);
}

test("catalog searches and filters, opens product photos and preserves the selected theme", async () => {
  await view("/shop?theme=sekai");
  expect(document.querySelectorAll("article")).toHaveLength(4);
  await page.getByRole("searchbox", { name: "搜索周边" }).fill(" 夜光 ");
  await expect.element(page.getByRole("heading", { name: products[1].name })).toBeVisible();
  expect(document.querySelectorAll("article")).toHaveLength(1);
  await page.getByRole("combobox", { name: "分类" }).selectOptions("钥匙扣");
  await page.getByRole("searchbox").fill("不存在的商品");
  await expect.element(page.getByText("没有找到相关周边")).toBeVisible();
  await page.getByRole("searchbox").fill("夜光");
  await page.getByRole("heading", { name: products[1].name }).click();
  await page.getByRole("button", { name: "查看第 2 张图片" }).click();
  await expect.element(page.getByRole("img", { name: products[1].name })).toHaveAttribute("src", products[1].images![1]);
  await expect.element(page.getByRole("button", { name: "查看第 2 张图片" })).toHaveAttribute("aria-pressed", "true");
  await expect.element(page.getByRole("link", { name: /购物清单/ })).toHaveAttribute("href", "/cart?theme=sekai");
});

test("product, cart and checkout share quantities, totals and persisted changes", async () => {
  await view("/shop/1?theme=sekai");
  await page.getByRole("button", { name: "加入购物清单 +" }).click();
  await expect.element(page.getByRole("status")).toHaveTextContent("已加入购物清单");
  expect(JSON.parse(localStorage.getItem(CART_KEY)!)).toEqual([{ id: "1", quantity: 1 }]);
  await page.getByRole("link", { name: "查看清单 →" }).click();
  await page.getByRole("button", { name: `增加 ${products[0].name} 数量` }).click();
  await expect.element(page.getByText("¥10.42", { exact: true })).toBeVisible();
  expect(JSON.parse(localStorage.getItem(CART_KEY)!)).toEqual([{ id: "1", quantity: 2 }]);
  await page.getByRole("button", { name: `减少 ${products[0].name} 数量` }).click();
  await expect.element(page.getByText("清单合计 / 1 件", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "前往小程序下单 ↗" }).click();
  await expect.element(page.getByRole("heading", { name: "扫码前往小程序" })).toBeVisible();
  await expect.element(page.getByRole("img", { name: "社团周边下单小程序码" })).toHaveAttribute("src", "/shop/checkout-qr.jpg");
  await expect.element(page.getByText("此清单不会自动同步到小程序。", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "← 返回购物清单" }).click();
  await page.getByRole("button", { name: "删除", exact: true }).click();
  await expect.element(page.getByText("清单还是空的")).toBeVisible();
  expect(localStorage.getItem(CART_KEY)).toBe("[]");
});

test("sold-out items cannot be added or increased but can be removed from a saved cart", async () => {
  products[0].inStock = false;
  localStorage.setItem(CART_KEY, JSON.stringify([{ id: "1", quantity: 1 }]));
  await view("/shop/1");
  await expect.element(page.getByRole("button", { name: "暂不可加入" })).toBeDisabled();
  await page.getByRole("link", { name: /购物清单/ }).click();
  await expect.element(page.getByText(/已售罄/)).toBeVisible();
  await expect.element(page.getByRole("button", { name: `增加 ${products[0].name} 数量` })).toBeDisabled();
  await page.getByRole("button", { name: `减少 ${products[0].name} 数量` }).click();
  await expect.element(page.getByText("清单还是空的")).toBeVisible();
});

test("missing products and an empty catalog have useful navigation", async () => {
  await view("/shop/not-a-product");
  await expect.element(page.getByRole("heading", { name: "商品未找到" })).toBeVisible();
  products.splice(0);
  await page.getByRole("link", { name: "返回周边目录 ↗" }).click();
  await expect.element(page.getByText("周边正在准备中")).toBeVisible();
});

test("products with one or no photo retain their detail information", async () => {
  products[0].images = undefined;
  await view("/shop/1");
  await expect.element(page.getByRole("img", { name: products[0].name })).toHaveAttribute("src", products[0].image);
  expect(document.querySelectorAll("button[aria-pressed]")).toHaveLength(0);
});

test("unavailable photos and a broken saved cart render without losing purchase navigation", async () => {
  products[0].images = []; products[0].image = "";
  localStorage.setItem(CART_KEY, "{invalid");
  await view("/shop/1");
  await expect.element(page.getByText("暂无商品图片")).toBeVisible();
  await page.getByRole("button", { name: "加入购物清单 +" }).click();
  expect(JSON.parse(localStorage.getItem(CART_KEY)!)).toEqual([{ id: "1", quantity: 1 }]);
});

test("failed persistence is visible, preserves the current cart and recovers on a later save", async () => {
  const storage = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
  await view("/shop/1");
  await page.getByRole("button", { name: "加入购物清单 +" }).click();
  await expect.element(page.getByRole("alert")).toHaveTextContent("浏览器未能保存购物清单");
  await expect.element(page.getByRole("link", { name: /购物清单 1/ })).toBeVisible();
  storage.mockRestore();
  await page.getByRole("button", { name: "加入购物清单 +" }).click();
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(CART_KEY)!)).toEqual([{ id: "1", quantity: 2 }]);
});

test("unavailable storage is reported and empty checkout directs visitors back to products", async () => {
  const storage = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
  await view("/cart");
  await expect.element(page.getByRole("alert")).toHaveTextContent("浏览器未能保存购物清单");
  storage.mockRestore();
  await view("/checkout");
  await expect.element(page.getByText("先选一点喜欢的周边")).toBeVisible();
});

test.each([
  ["https://checkout.example.invalid/qr.png", "external"],
  ["   ", "unconfigured"],
])("checkout respects the configured QR channel: %s", async (url, mode) => {
  vi.stubEnv("VITE_SHOP_QR_URL", url);
  localStorage.setItem(CART_KEY, JSON.stringify([{ id: "1", quantity: 1 }]));
  await view("/checkout");
  if (mode === "external") await expect.element(page.getByRole("img", { name: "社团周边下单小程序码" })).toHaveAttribute("src", url);
  else await expect.element(page.getByText("下单渠道尚未开放")).toBeVisible();
});

function CartProbe({ name }: { name: string }) {
  const cart = useCart();
  return <section aria-label={name}><output aria-label={`${name} count`}>{cart.count}</output>
    <button onClick={() => { cart.add("1"); cart.add("1"); }}>{name} add twice</button></section>;
}

test("cart instances share same-tab changes and handle other-tab storage updates and clearing", async () => {
  await render(<><CartProbe name="first" /><CartProbe name="second" /></>);
  await page.getByRole("button", { name: "first add twice" }).click();
  await expect.element(page.getByLabelText("first count")).toHaveTextContent("2");
  await expect.element(page.getByLabelText("second count")).toHaveTextContent("2");
  window.dispatchEvent(new StorageEvent("storage", { key: CART_KEY, newValue: JSON.stringify([{ id: "2", quantity: 5 }]), storageArea: localStorage }));
  await expect.element(page.getByLabelText("second count")).toHaveTextContent("5");
  window.dispatchEvent(new StorageEvent("storage", { key: "unrelated", newValue: "[]", storageArea: localStorage }));
  window.dispatchEvent(new StorageEvent("storage", { key: CART_KEY, newValue: "[]", storageArea: sessionStorage }));
  await expect.element(page.getByLabelText("first count")).toHaveTextContent("5");
  window.dispatchEvent(new StorageEvent("storage", { key: null, newValue: null, storageArea: localStorage }));
  await expect.element(page.getByLabelText("first count")).toHaveTextContent("0");
  await expect.element(page.getByLabelText("second count")).toHaveTextContent("0");
});
