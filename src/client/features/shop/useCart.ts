import { useEffect, useRef, useState } from "react";
import { addCartItem, CART_KEY, parseCart, setCartQuantity, summarizeCart, type CartEntry } from "./cart";

const CART_CHANGED = "xtbang:cart-changed";
const STORAGE_ERROR = "浏览器未能保存购物清单，请允许此站点使用本地存储。";
type CartState = { entries: CartEntry[]; error: string };

function loadCart(): CartState {
  try { return { entries: parseCart(localStorage.getItem(CART_KEY)), error: "" }; }
  catch { return { entries: [], error: STORAGE_ERROR }; }
}

export function useCart() {
  const [state, setState] = useState(loadCart);
  const current = useRef(state.entries);
  useEffect(() => {
    function apply(next: CartState) { current.current = next.entries; setState(next); }
    function stored(event: StorageEvent) {
      if ((event.key === CART_KEY || event.key === null) && (!event.storageArea || event.storageArea === localStorage)) {
        apply({ entries: parseCart(event.newValue), error: "" });
      }
    }
    function changed(event: Event) { apply((event as CustomEvent<CartState>).detail); }
    window.addEventListener("storage", stored);
    window.addEventListener(CART_CHANGED, changed);
    return () => {
      window.removeEventListener("storage", stored);
      window.removeEventListener(CART_CHANGED, changed);
    };
  }, []);
  function update(entries: CartEntry[]) {
    let error = "";
    try { localStorage.setItem(CART_KEY, JSON.stringify(entries)); }
    catch { error = STORAGE_ERROR; }
    const next = { entries, error };
    current.current = entries;
    setState(next);
    window.dispatchEvent(new CustomEvent(CART_CHANGED, { detail: next }));
  }
  return {
    ...summarizeCart(state.entries),
    error: state.error,
    add(id: string) { update(addCartItem(current.current, id)); },
    quantity(id: string, quantity: number) { update(setCartQuantity(current.current, id, quantity)); },
  };
}
