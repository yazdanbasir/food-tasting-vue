<script setup lang="ts">
import AppPanel from '@/components/AppPanel.vue'
import DishNameInput from '@/components/DishNameInput.vue'
import GroupMembersInput from '@/components/GroupMembersInput.vue'
import IngredientSearch from '@/components/IngredientSearch.vue'
import IngredientList from '@/components/IngredientList.vue'
</script>

<template>
  <div class="h-full flex flex-col mx-2 text-[17px]">
    <div class="flex-1 flex gap-4 mx-4 mt-4 mb-6 overflow-hidden min-h-0">
      <!-- Left column -->
      <div class="[flex:20] min-w-0 flex flex-col gap-4 overflow-hidden min-h-0">
        <AppPanel title="dish name" variant="dish-name">
          <DishNameInput />
        </AppPanel>
        <AppPanel title="group members" variant="group-members" collapsible :expanded="true">
          <GroupMembersInput />
        </AppPanel>
        <AppPanel title="recommended recipe?" variant="lower" collapsible :expanded="false" />
      </div>

      <!-- Right column -->
      <div class="[flex:35] min-w-0 flex flex-col gap-4 min-h-0">
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
