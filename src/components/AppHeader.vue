<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()
// Runtime path so Vite doesn't resolve at build time (file may not exist yet)
const lafayetteLogoSrc = '/lafayette-logo.png'
</script>

<template>
  <header
    class="h-14 flex-none flex items-center justify-between px-4 gap-4"
    style="background-color: #ececf1;"
  >
    <!-- Left: Lafayette logo (add public/lafayette-logo.png to show) -->
    <div class="flex items-center min-w-0 flex-[1] justify-start">
      <img
        :src="lafayetteLogoSrc"
        alt="Lafayette"
        class="h-8 object-contain object-left"
        @error="($event.target as HTMLImageElement).style.display = 'none'"
      />
    </div>

    <!-- Center: ISA logo -->
    <div class="flex items-center justify-center flex-none">
      <img
        src="/isa-logo.png"
        alt="ISA"
        class="h-9 object-contain"
      />
    </div>

    <!-- Right: Form + Submissions -->
    <div class="flex items-center gap-2 min-w-0 flex-[1] justify-end">
      <RouterLink
        to="/"
        class="rounded-full px-4 py-1 min-h-8 flex items-center font-mono text-sm transition-colors flex-none"
        :class="route.path === '/' ? 'bg-black text-white' : 'bg-white text-black'"
      >
        Form
      </RouterLink>
      <RouterLink
        to="/organizer"
        class="rounded-full px-4 py-1 min-h-8 flex items-center font-mono text-sm transition-colors flex-none"
        :class="route.path.startsWith('/organizer') ? 'bg-black text-white' : 'bg-white text-black'"
      >
        Submissions
      </RouterLink>
    </div>
  </header>
</template>
