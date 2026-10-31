import { Link, useLocation } from "react-router-dom";
import { resolveHomeTheme, themeHref } from "../lib/home-theme";
import { useCart } from "../features/shop/useCart";
import { ShopShell } from "../features/shop/ShopShell";
import styles from "./Shop.module.css";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { products, money } from "../features/shop/catalog";

export function ProductPage() {
  const themeId = resolveHomeTheme(useLocation().search);
  const { id } = useParams();
  const product = products.find((item) => item.id === id);
  const [activeIndex, setActiveIndex] = useState(0);
  const [added, setAdded] = useState(false);
  const cart = useCart();
  if (!product)
    return (
      <ShopShell title="商品未找到" label="COMMUNITY GOODS">
        <div className={styles.empty}>
          <p>这件商品当前不在目录中。</p>
          <Link className={styles.button} to={themeHref("/shop", themeId)}>
            返回周边目录 ↗
          </Link>
        </div>
      </ShopShell>
    );
  const gallery = product.images?.length
    ? product.images
    : product.image
      ? [product.image]
      : [];
  return (
    <ShopShell title="社团周边" label="COMMUNITY GOODS" count={cart.count}>
      <Link className={styles.back} to={themeHref("/shop", themeId)}>
        ← 全部周边
      </Link>
      <div className={styles.detail}>
        <div>
          <div className={styles.detailImage}>
            {gallery.length ? (
              <img
                src={gallery[Math.min(activeIndex, gallery.length - 1)]}
                alt={product.name}
              />
            ) : (
              <span>暂无商品图片</span>
            )}
          </div>
          {gallery.length > 1 && (
            <div className={styles.thumbnails}>
              {gallery.map((image, index) => (
                <button
                  key={image}
                  onClick={() => setActiveIndex(index)}
                  aria-label={`查看第 ${index + 1} 张图片`}
                  aria-pressed={index === activeIndex}
                >
                  <img src={image} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className={styles.detailInfo}>
          <p className={styles.eyebrow}>{product.category}</p>
          <h2>{product.name}</h2>
          <p>{product.description}</p>
          <strong className={styles.price}>{money(product.price)}</strong>
          <p>款式、价格与库存请在小程序确认。</p>
          <button
            className={styles.button}
            disabled={!product.inStock}
            onClick={() => {
              cart.add(product.id);
              setAdded(true);
            }}
          >
            {product.inStock ? "加入购物清单 +" : "暂不可加入"}
          </button>
          {added && (
            <p role="status">
              已加入购物清单。<Link to={themeHref("/cart", themeId)}>查看清单 →</Link>
            </p>
          )}
          {cart.error && <p role="alert">{cart.error}</p>}
        </div>
      </div>
    </ShopShell>
  );
}

