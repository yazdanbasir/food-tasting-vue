<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <header class="h-14 flex items-center justify-center gap-2" style="background-color: #ececf1;">
    <RouterLink
      to="/"
      class="rounded-full px-4 py-1 min-h-8 flex items-center font-mono text-sm transition-colors"
      :class="route.path === '/' ? 'bg-black text-white' : 'bg-white text-black'"
    >
      Form
    </RouterLink>
    <RouterLink
      to="/organizer"
      class="rounded-full px-4 py-1 min-h-8 flex items-center font-mono text-sm transition-colors"
      :class="route.path.startsWith('/organizer') ? 'bg-black text-white' : 'bg-white text-black'"
    >
      Submissions
    </RouterLink>
  </header>
</template>
