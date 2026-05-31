<script setup lang="ts">
import { useCartStore } from '../stores/cart'

const cart = useCartStore()
</script>

<template>
  <section class="max-w-3xl mx-auto px-4 py-12">
    <h1 class="text-3xl font-bold mb-8">🛒 购物车</h1>

    <div v-if="cart.items.length">
      <div
        v-for="item in cart.items"
        :key="item.product.id"
        class="flex items-center gap-4 bg-white rounded-lg p-4 mb-4 shadow-sm"
      >
        <img
          :src="item.product.image"
          :alt="item.product.name"
          class="w-20 h-20 rounded-lg object-cover"
        />
        <div class="flex-1">
          <h3 class="font-semibold">{{ item.product.name }}</h3>
          <p class="text-sm text-gray-500">¥{{ item.product.price.toFixed(2) }}</p>
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="cart.updateQuantity(item.product.id, item.quantity - 1)"
            class="w-8 h-8 rounded border text-lg font-bold hover:bg-gray-100"
          >−</button>
          <span class="w-8 text-center font-medium">{{ item.quantity }}</span>
          <button
            @click="cart.updateQuantity(item.product.id, item.quantity + 1)"
            class="w-8 h-8 rounded border text-lg font-bold hover:bg-gray-100"
          >+</button>
        </div>
        <button @click="cart.removeItem(item.product.id)" class="text-red-500 hover:text-red-700 text-sm">删除</button>
      </div>

      <div class="bg-white rounded-lg p-6 shadow-sm mt-6">
        <div class="flex justify-between text-lg font-bold">
          <span>合计</span>
          <span class="text-brand-700">¥{{ cart.totalPrice.toFixed(2) }}</span>
        </div>
        <router-link
          to="/checkout"
          class="block w-full mt-4 py-3 bg-brand-600 text-white text-center rounded-lg font-medium hover:bg-brand-700 transition"
        >去结算</router-link>
      </div>
    </div>

    <div v-else class="text-center py-20">
      <p class="text-xl text-gray-500 mb-4">购物车空空如也</p>
      <router-link to="/shop" class="text-brand-600 hover:underline">去逛逛 →</router-link>
    </div>
  </section>
</template>
