<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useOrganizerAuthStore } from '@/stores/organizerAuth'
import OrganizerLoginView from '@/views/OrganizerLoginView.vue'
import OrganizerDashboardView from '@/views/OrganizerDashboardView.vue'

const authStore = useOrganizerAuthStore()
const { token } = storeToRefs(authStore)

const hasToken = computed(() => !!token.value)
</script>

<template>
  <OrganizerLoginView v-if="!hasToken" />
  <OrganizerDashboardView v-else />
</template>
