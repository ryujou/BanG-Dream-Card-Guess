<template>
  <main class="login-shell">
    <section class="login-panel">
      <p class="eyebrow">Host Login</p>
      <h1>主持登录</h1>
      <form id="loginForm" class="login-form" @submit.prevent="handleLogin">
        <label class="setting-field">
          <span>主持密码</span>
          <input 
            name="password" 
            type="password" 
            autocomplete="current-password" 
            placeholder="输入主持密码" 
            autofocus 
            v-model="password"
          />
        </label>
        <div v-if="loginError" class="login-error">{{ loginError }}</div>
        <button class="primary" type="submit">登录</button>
        <router-link class="text-link" to="/player">返回玩家页</router-link>
      </form>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { apiFetch } from '../api/http';

const route = useRoute();
const password = ref("");
const loginError = ref("");

function safeNextPath(value: string | null): string {
  const next = String(value || "/host");
  return next.startsWith("/") && !next.startsWith("//") ? next : "/host";
}

async function handleLogin() {
  loginError.value = "";
  
  try {
    const response = await apiFetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ password: password.value || "" }),
    });

    if (response.ok) {
      const nextPath = safeNextPath(route.query.next as string | null);
      // Wait for router push
      window.location.href = nextPath; // Keep the original href navigation to reset socket completely if needed, or use router
      // actually router.push(nextPath) is better for SPA, but if they depend on reload:
      // router.push(nextPath);
      return;
    }

    loginError.value = "密码错误";
  } catch (e) {
    loginError.value = "请求失败";
  }
}
</script>
