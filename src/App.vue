<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden">
    <AppHeader />
    <main class="flex-1 min-h-0 overflow-hidden">
      <RouterView />
    </main>
  </div>
</template>
