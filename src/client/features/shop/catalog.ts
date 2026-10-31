import catalog from "../../data/products.json";

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  image: string;
  images?: string[];
  inStock: boolean;
}

export const products: Product[] = catalog;
export const money = (price: number) => `¥${price.toFixed(2)}`;

export function filterProducts(search: string, category: string, catalog = products) {
  const query = search.trim().toLocaleLowerCase();
  return catalog.filter(product =>
    (category === "全部" || product.category === category) &&
    product.name.toLocaleLowerCase().includes(query),
  );
}
