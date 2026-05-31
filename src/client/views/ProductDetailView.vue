<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useCartStore } from '../stores/cart'
import productsData from '../data/products.json'
import type { Product } from '../types/shop'

const products = productsData as Product[]

const route = useRoute()
const cart = useCartStore()

const product = computed(() => products.find(p => p.id === route.params.id))
const hasGallery = computed(() => product.value?.images && product.value.images.length > 1)
const gallery = computed(() => product.value?.images ?? (product.value ? [product.value.image] : []))
const activeIndex = ref(0)
</script>

<template>
  <section class="max-w-4xl mx-auto px-4 py-12 pb-20">
    <div v-if="product" class="grid md:grid-cols-2 gap-10">
      <div>
        <img
          :src="gallery[activeIndex]"
          :alt="product.name"
          class="w-full rounded-xl mb-3"
        />
        <div v-if="hasGallery" class="flex gap-2 overflow-x-auto">
          <button
            v-for="(img, i) in gallery"
            :key="i"
            @click="activeIndex = i"
            class="w-16 h-16 rounded-lg border-2 shrink-0 overflow-hidden transition"
            :class="i === activeIndex ? 'border-brand-600' : 'border-gray-200 hover:border-gray-400'"
          >
            <img :src="img" :alt="`${product.name} ${i + 1}`" class="w-full h-full object-cover" />
          </button>
        </div>
      </div>
      <div>
        <span class="text-sm text-gray-500 uppercase tracking-wide">{{ product.category }}</span>
        <h1 class="text-3xl font-bold mt-1 mb-2">{{ product.name }}</h1>
        <div class="flex items-center gap-2 mb-4">
          <span class="text-yellow-500">⭐ {{ product.rating }}</span>
          <span
            :class="product.inStock ? 'text-green-600' : 'text-red-500'"
            class="text-sm font-medium"
          >{{ product.inStock ? '有货' : '已售罄' }}</span>
        </div>
        <p class="text-gray-600 mb-6">{{ product.description }}</p>
        <p class="text-3xl font-bold text-brand-700 mb-6">¥{{ product.price.toFixed(2) }}</p>
        <button
          @click="cart.addItem(product)"
          :disabled="!product.inStock"
          class="w-full py-3 rounded-lg font-medium text-lg transition"
          :class="product.inStock ? 'bg-brand-600 text-white hover:bg-brand-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'"
        >
          {{ product.inStock ? '加入购物车' : '已售罄' }}
        </button>
        <router-link to="/shop" class="block text-center mt-4 text-brand-600 hover:underline text-sm">← 返回商城</router-link>
      </div>
    </div>

    <!-- 浮动购物车按钮 -->
    <router-link v-if="cart.totalItems" to="/cart" class="fixed bottom-6 right-6 z-50 bg-brand-600 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:bg-brand-700 transition hover:scale-110">
      <span class="text-xl">🛒</span>
      <span class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">{{ cart.totalItems }}</span>
    </router-link>
    <div v-else class="text-center py-20">
      <p class="text-xl text-gray-500">商品未找到。</p>
      <router-link to="/shop" class="text-brand-600 hover:underline mt-2 inline-block">浏览商品</router-link>
    </div>
  </section>
</template>
