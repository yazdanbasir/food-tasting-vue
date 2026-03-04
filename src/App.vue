<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
</script>

<template>
  <div class="app-outer min-h-screen flex flex-col md:h-screen md:overflow-hidden">
    <div class="app-header-wrap">
      <AppHeader />
    </div>
    <main class="app-main flex-col flex-1 min-h-0 md:overflow-hidden">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-header-wrap {
  margin: 1rem;
  flex: none;
}
</style>
