<script setup lang="ts">
import AppPanel from '@/components/AppPanel.vue'
import CountrySelect from '@/components/CountrySelect.vue'
import DishNameInput from '@/components/DishNameInput.vue'
import GroupMembersInput from '@/components/GroupMembersInput.vue'
import IngredientSearch from '@/components/IngredientSearch.vue'
import IngredientList from '@/components/IngredientList.vue'
</script>

<template>
  <div class="home-view">
    <div class="home-intro">
      <h1 class="home-title">Submit your dish</h1>
      <p class="home-subtitle">Add your dish details and ingredients below.</p>
    </div>
    <div class="home-layout">
      <!-- Left column -->
      <div class="home-left">
        <AppPanel title="country" variant="country">
          <CountrySelect />
        </AppPanel>
        <AppPanel title="dish name" variant="dish-name">
          <DishNameInput />
        </AppPanel>
        <AppPanel title="group members" variant="group-members" collapsible :expanded="true">
          <GroupMembersInput />
        </AppPanel>
        <AppPanel title="recommended recipe?" variant="lower" collapsible :expanded="false" />
      </div>

      <!-- Right column -->
      <div class="home-right">
        <AppPanel title="search" variant="search-slim">
          <IngredientSearch />
        </AppPanel>
        <AppPanel title="grocery list" variant="upper">
          <IngredientList />
        </AppPanel>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Single spacing unit (1rem) for left, right, top, bottom, and between sections - matches original pill-to-bar gap */
.home-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 1rem;
  font-size: var(--body-font-size, 1.125rem);
  overflow: hidden;
}

.home-intro {
  flex: none;
  margin-bottom: 1rem;
  text-align: center;
  max-width: 36rem;
  margin-left: auto;
  margin-right: auto;
}

.home-title {
  font-size: clamp(1.75rem, 1.75rem + ((1vw - 0.48rem) * 8.4135), 2rem);
  line-height: 2.25rem;
  color: var(--color-lafayette-gray, #3c373c);
  font-weight: 700;
  margin: 0 0 0.25rem 0;
}

.home-subtitle {
  font-size: var(--body-font-size, 1.125rem);
  color: var(--color-lafayette-gray, #3c373c);
  margin: 0;
}

.home-layout {
  flex: 1;
  display: flex;
  gap: 1rem;
  overflow: hidden;
  min-height: 0;
}

.home-left {
  flex: 20;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow: hidden;
  min-height: 0;
}

.home-right {
  flex: 35;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 0;
  overflow: hidden;
}
</style>
