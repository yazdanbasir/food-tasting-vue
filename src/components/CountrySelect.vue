<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useSubmissionStore } from '@/stores/submission'
import { COUNTRIES, flagEmoji } from '@/data/countries'

const { countryCode } = storeToRefs(useSubmissionStore())
</script>

<template>
  <select
    v-model="countryCode"
    class="country-select w-full bg-white rounded-full pl-4 pr-8 py-1 min-h-8 outline-none border-0 appearance-none cursor-pointer font-inherit"
    :class="{ 'country-placeholder': !countryCode }"
    style="background-image: url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22%3E%3Cpath fill=%22%23666%22 d=%22M6 8L1 3h10z%22/%3E%3C/svg%3E'); background-repeat: no-repeat; background-position: right 0.75rem center;"
  >
      <option value="">country...</option>
      <option
        v-for="c in COUNTRIES"
        :key="c.code"
        :value="c.code"
      >
        {{ flagEmoji(c.code) }} {{ c.name }}
      </option>
  </select>
</template>

<style scoped>
.country-select.country-placeholder {
  color: #9ca3af;
}
</style>
