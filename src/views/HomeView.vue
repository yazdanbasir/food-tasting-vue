<script setup lang="ts">
import AppPanel from '@/components/AppPanel.vue'
</script>

<template>
  <div class="h-full flex flex-col mx-2 text-[17px]">
    <div class="flex-1 flex gap-4 mx-4 mt-4 mb-6 overflow-hidden min-h-0">
      <div class="[flex:20] min-w-0 flex flex-col gap-4 overflow-hidden min-h-0">
        <AppPanel title="dish name" variant="dish-name" />
        <AppPanel title="group members" variant="group-members" collapsible :expanded="true" />
        <AppPanel title="recommended recipe?" variant="lower" collapsible :expanded="false" />
      </div>
      <div class="[flex:35] min-w-0 flex flex-col gap-4 overflow-hidden min-h-0">
        <AppPanel title="search" variant="search" />
        <AppPanel title="grocery list" variant="upper" />
      </div>
    </div>
  </div>
</template>
