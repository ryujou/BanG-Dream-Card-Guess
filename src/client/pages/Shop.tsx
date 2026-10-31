import { Link, useLocation } from "react-router-dom";
import { resolveHomeTheme, themeHref } from "../lib/home-theme";
import { useCart } from "../features/shop/useCart";
import { ShopShell } from "../features/shop/ShopShell";
import styles from "./Shop.module.css";
import { useState } from "react";
import { HOME_THEMES } from "../lib/home-theme";
import { StageStar } from "../components/StageShapes";
import { products, money, filterProducts } from "../features/shop/catalog";

export function ShopPage() {
  const themeId = resolveHomeTheme(useLocation().search);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("全部");
  const cart = useCart();
  const categories = [
    "全部",
    ...new Set(products.map((product) => product.category)),
  ];
  const filtered = filterProducts(search, category);
  return (
    <ShopShell
      title="把热爱带回家"
      label="COMMUNITY GOODS / 社团周边"
      count={cart.count}
      poster
    >
      <p className={styles.intro}>
        来自湘潭 {HOME_THEMES[themeId].brand} 同好会的周边。挑选喜欢的款式，通过小程序下单。
      </p>
      {products.length ? (
        <>
          <div className={styles.toolbar}>
            <label>
              搜索周边
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="输入商品名称"
              />
            </label>
            <label>
              分类
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {categories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>
          <div className={styles.grid}>
            {filtered.map((product) => (
              <article className={styles.product} key={product.id}>
                <Link to={themeHref(`/shop/${encodeURIComponent(product.id)}`, themeId)}>
                  <div className={styles.productImage}>
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        loading="lazy"
                      />
                    ) : (
                      <span>暂无商品图片</span>
                    )}
                  </div>
                  <p className={styles.category}>{product.category}</p>
                  <h2>{product.name}</h2>
                </Link>
                <div className={styles.productBottom}>
                  <strong>{money(product.price)}</strong>
                  <span>小程序下单</span>
                </div>
              </article>
            ))}
          </div>
          {!filtered.length && (
            <div className={styles.empty}>
              <StageStar className={styles.emptyMark} />
              <h2>没有找到相关周边</h2>
              <p>试试其他关键词或分类。</p>
            </div>
          )}
        </>
      ) : (
        <div className={styles.empty}>
          <StageStar className={styles.emptyMark} />
          <h2>周边正在准备中</h2>
          <p>商品上架后会在这里展示。</p>
          <Link className={styles.button} to={themeHref("/", themeId)}>
            回到同好会 ↗
          </Link>
        </div>
      )}
    </ShopShell>
  );
}

