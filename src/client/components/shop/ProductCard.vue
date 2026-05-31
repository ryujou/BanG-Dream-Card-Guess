<script setup lang="ts">
import type { Product } from '../../types/shop'
import { useCartStore } from '../../stores/cart'

const props = defineProps<{ product: Product }>()
const cart = useCartStore()
</script>

<template>
  <div class="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition group">
    <router-link :to="`/shop/${product.id}`">
      <img
        :src="product.image"
        :alt="product.name"
        class="w-full h-48 object-cover group-hover:scale-105 transition-transform"
      />
    </router-link>
    <div class="p-4">
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs text-gray-500 uppercase tracking-wide">{{ product.category }}</span>
        <span class="text-xs text-yellow-500">⭐ {{ product.rating }}</span>
      </div>
      <router-link
        :to="`/shop/${product.id}`"
        class="font-semibold text-gray-900 hover:text-brand-600"
      >{{ product.name }}</router-link>
      <p class="text-sm text-gray-500 mt-1 line-clamp-2">{{ product.description }}</p>
      <div class="flex items-center justify-between mt-3">
        <span class="text-lg font-bold text-brand-700">¥{{ product.price.toFixed(2) }}</span>
        <button
          type="button"
          @click.stop="cart.addItem(product)"
          :disabled="!product.inStock"
          class="px-3 py-1.5 text-sm rounded-lg font-medium transition cursor-pointer"
          :class="product.inStock ? 'bg-brand-600 text-white hover:bg-brand-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'"
        >
          {{ product.inStock ? '加入购物车' : '已售罄' }}
        </button>
      </div>
    </div>
  </div>
</template>
