<script setup lang="ts">
import AppPanel from '@/components/AppPanel.vue'
import CountrySelect from '@/components/CountrySelect.vue'
import DishNameInput from '@/components/DishNameInput.vue'
import GroupMembersInput from '@/components/GroupMembersInput.vue'
import IngredientSearch from '@/components/IngredientSearch.vue'
import IngredientList from '@/components/IngredientList.vue'
</script>

<template>
  <div class="h-full flex flex-col mx-2 text-[17px] overflow-hidden">
    <div class="flex-1 flex gap-4 mx-4 mt-3 mb-3 overflow-hidden min-h-0">
      <!-- Left column -->
      <div class="[flex:20] min-w-0 flex flex-col gap-4 overflow-hidden min-h-0">
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
      <div class="[flex:35] min-w-0 flex flex-col gap-4 min-h-0 overflow-hidden">
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
