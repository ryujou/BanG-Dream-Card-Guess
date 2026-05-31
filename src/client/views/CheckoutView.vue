<script setup lang="ts">
import { useCartStore } from '../stores/cart'

const cart = useCartStore()
</script>

<template>
  <section class="max-w-xl mx-auto px-4 py-12 text-center">
    <div v-if="!cart.items.length" class="py-20">
      <p class="text-xl text-gray-500 mb-4">购物车是空的</p>
      <router-link to="/shop" class="text-brand-600 hover:underline">去逛逛 →</router-link>
    </div>
    <div v-else>
      <h1 class="text-3xl font-bold mb-2">📱 小程序下单</h1>
      <p class="text-gray-600 mb-2">合计 <span class="text-brand-700 font-bold text-lg">¥{{ cart.totalPrice.toFixed(2) }}</span></p>
      <p class="text-gray-500 mb-6 text-sm">扫描下方小程序码完成下单</p>
      <img
        src="https://i.imgs.ovh/2026/05/31/7c57463118e5e8a36f3386d7727691d8.jpg"
        alt="小程序下单码"
        class="block mx-auto w-64 h-64 rounded-xl shadow-md mb-6"
      />
      <router-link to="/shop" class="inline-block text-brand-600 hover:underline text-sm">← 返回商城</router-link>
    </div>
  </section>
</template>
