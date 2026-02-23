<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const accessCode = route.params.accessCode as string
</script>

<template>
  <div class="h-full flex flex-col items-center justify-center gap-8 mx-4 text-[17px]">
    <div class="bg-[#ececf1] rounded-2xl p-10 flex flex-col items-center gap-6 max-w-md w-full">
      <div class="text-center">
        <div class="text-sm text-gray-500 mb-2">submission received</div>
        <div class="text-3xl font-bold tracking-widest text-black">{{ accessCode }}</div>
      </div>

      <p class="text-sm text-gray-500 text-center leading-relaxed">
        Save this code. You'll need it to look up or edit your submission later.
      </p>

      <button
        class="rounded-full px-6 py-2 bg-black text-white cursor-pointer hover:opacity-80 transition-opacity"
        @click="router.push('/')"
      >
        submit another
      </button>
    </div>
  </div>
</template>
