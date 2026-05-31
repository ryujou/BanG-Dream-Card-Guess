<script setup lang="ts">
import { ref, computed } from 'vue'
import ProductCard from '../components/shop/ProductCard.vue'
import productsData from '../data/products.json'
import type { Product } from '../types/shop'
import { useCartStore } from '../stores/cart'

const products = productsData as Product[]
const cart = useCartStore()

const search = ref('')
const category = ref('全部')

const categories = ['全部', ...new Set(products.map(p => p.category))]

const filtered = computed(() =>
  products.filter(p =>
    (category.value === '全部' || p.category === category.value) &&
    p.name.toLowerCase().includes(search.value.toLowerCase())
  )
)
</script>

<template>
  <section class="max-w-7xl mx-auto px-4 py-12 pb-20">
    <h1 class="text-3xl font-bold mb-2">🛍️ 社团周边商城</h1>
    <p class="text-gray-500 mb-8">湘潭 BanG Dream! 同好会自制周边，支持社团，把爱带回家</p>

    <div class="flex flex-col sm:flex-row gap-4 mb-8">
      <input
        v-model="search"
        placeholder="搜索商品…"
        class="flex-1 min-w-0 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
      />
      <select
        v-model="category"
        class="w-36 sm:w-44 px-4 py-2 pr-8 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none appearance-none bg-white shrink-0"
        style="background-image: url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%236b7280%22><path fill-rule=%22evenodd%22 d=%22M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z%22 clip-rule=%22evenodd%22/></svg>'); background-repeat: no-repeat; background-position: right 0.5rem center; background-size: 1.25rem 1.25rem;"
      >
        <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
      </select>
    </div>

    <div v-if="filtered.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <ProductCard v-for="product in filtered" :key="product.id" :product="product" />
    </div>
    <p v-else class="text-gray-500 text-center py-12">没有找到相关商品。</p>

    <!-- 浮动购物车按钮 -->
    <router-link v-if="cart.totalItems" to="/cart" class="fixed bottom-6 right-6 z-50 bg-brand-600 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:bg-brand-700 transition hover:scale-110">
      <span class="text-xl">🛒</span>
      <span class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">{{ cart.totalItems }}</span>
    </router-link>
  </section>
</template>
