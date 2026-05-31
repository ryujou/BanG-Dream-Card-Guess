export interface Product {
  id: string
  name: string
  price: number
  image: string
  images?: string[]
  description: string
  category: string
  rating: number
  inStock: boolean
}

export interface CartItem {
  product: Product
  quantity: number
}
