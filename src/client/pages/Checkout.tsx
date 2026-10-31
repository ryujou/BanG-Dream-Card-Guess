import { Link, useLocation } from "react-router-dom";
import { resolveHomeTheme, themeHref } from "../lib/home-theme";
import { useCart } from "../features/shop/useCart";
import { ShopShell } from "../features/shop/ShopShell";
import styles from "./Shop.module.css";
import { money } from "../features/shop/catalog";

const CHECKOUT_QR_URL = "/shop/checkout-qr.jpg";

export function CheckoutPage() {
  const themeId = resolveHomeTheme(useLocation().search);
  const cart = useCart();
  const qrUrl = String(
    import.meta.env.VITE_SHOP_QR_URL || CHECKOUT_QR_URL,
  ).trim();
  return (
    <ShopShell title="小程序下单" label="CHECKOUT" count={cart.count}>
      <div className={styles.checkout}>
        {!cart.items.length ? (
          <>
            <h2>先选一点喜欢的周边</h2>
            <Link className={styles.button} to={themeHref("/shop", themeId)}>
              浏览周边 ↗
            </Link>
          </>
        ) : (
          <>
            <p className={styles.eyebrow}>{cart.count} 件周边 · 清单合计</p>
            <strong className={styles.price}>{money(cart.total)}</strong>
            {qrUrl ? (
              <>
                <img
                  className={styles.qr}
                  src={qrUrl}
                  alt="社团周边下单小程序码"
                />
                <h2>扫码前往小程序</h2>
                <p>
                  请在小程序中选择对应商品并完成下单。此清单不会自动同步到小程序。
                </p>
              </>
            ) : (
              <>
                <h2>下单渠道尚未开放</h2>
                <p>当前尚未配置小程序码，购物清单已保存在这个浏览器中。</p>
              </>
            )}
            <Link className={styles.back} to={themeHref("/cart", themeId)}>
              ← 返回购物清单
            </Link>
          </>
        )}
      </div>
    </ShopShell>
  );
}
