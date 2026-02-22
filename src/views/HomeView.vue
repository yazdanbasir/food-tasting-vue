<script setup lang="ts">
import AppPanel from '@/components/AppPanel.vue'
</script>

<template>
  <div class="page">
    <div class="main">
      <div class="left-column">
        <AppPanel title="dish name" variant="dish-name" />
        <AppPanel title="group members" variant="group-members" collapsible :expanded="true" />
        <AppPanel title="recommended recipe?" variant="lower" collapsible :expanded="false" />
      </div>
      <div class="right-column">
        <AppPanel title="search" variant="search" />
        <AppPanel title="grocery list" variant="upper" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.page {
  font-family: 'Roboto Mono', monospace;
  font-size: 17px;
  height: 100%;
  display: flex;
  flex-direction: column;
  margin: 0 8px;
}

.main {
  flex: 1;
  display: flex;
  gap: 16px;
  margin: 16px 16px 24px;
  overflow: hidden;
  min-height: 0;
}

.left-column {
  flex: 20;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
  min-height: 0;
}

.right-column {
  flex: 35;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
  min-height: 0;
}
</style>
