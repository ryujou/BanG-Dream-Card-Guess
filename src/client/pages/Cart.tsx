import { Link, useLocation } from "react-router-dom";
import { resolveHomeTheme, themeHref } from "../lib/home-theme";
import { useCart } from "../features/shop/useCart";
import { ShopShell } from "../features/shop/ShopShell";
import styles from "./Shop.module.css";
import { money } from "../features/shop/catalog";

export function CartPage() {
  const themeId = resolveHomeTheme(useLocation().search);
  const cart = useCart();
  return (
    <ShopShell title="你的购物清单" label="YOUR PICKS" count={cart.count}>
      {cart.items.length ? (
        <div className={styles.cartLayout}>
          <div>
            {cart.items.map(({ product, quantity }) => (
              <article key={product.id} className={styles.cartItem}>
                {product.image && (
                  <img src={product.image} alt={product.name} />
                )}
                <div>
                  <Link to={themeHref(`/shop/${encodeURIComponent(product.id)}`, themeId)}>
                    <h2>{product.name}</h2>
                  </Link>
                  <p>
                    {money(product.price)}
                    {!product.inStock && " · 已售罄"}
                  </p>
                  <div className={styles.quantity}>
                    <button
                      aria-label={`减少 ${product.name} 数量`}
                      onClick={() => cart.quantity(product.id, quantity - 1)}
                    >
                      −
                    </button>
                    <span>{quantity}</span>
                    <button
                      disabled={!product.inStock}
                      aria-label={`增加 ${product.name} 数量`}
                      onClick={() => cart.quantity(product.id, quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
                <button
                  className={styles.remove}
                  onClick={() => cart.quantity(product.id, 0)}
                >
                  删除
                </button>
              </article>
            ))}
          </div>
          <aside className={styles.summary}>
            <p className={styles.eyebrow}>清单合计 / {cart.count} 件</p>
            <strong>{money(cart.total)}</strong>
            <p>实际库存、价格与交易以小程序为准。</p>
            <Link className={styles.button} to={themeHref("/checkout", themeId)}>
              前往小程序下单 ↗
            </Link>
            <Link className={styles.back} to={themeHref("/shop", themeId)}>
              继续挑选
            </Link>
          </aside>
        </div>
      ) : (
        <div className={styles.empty}>
          <h2>清单还是空的</h2>
          <p>遇到喜欢的周边，先把它加进来。</p>
          <Link className={styles.button} to={themeHref("/shop", themeId)}>
            看看周边 ↗
          </Link>
        </div>
      )}
      {cart.error && <p role="alert">{cart.error}</p>}
    </ShopShell>
  );
}

