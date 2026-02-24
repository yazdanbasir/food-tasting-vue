<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useSubmissionStore } from '@/stores/submission'

const store = useSubmissionStore()
const { masterGroceryList, totalCents } = storeToRefs(store)

function formatAisleTitle(aisle: string): string {
  if (!aisle || aisle === 'Other' || aisle === 'Unknown') return 'Aisle Unknown'
  return `Aisle ${aisle}`
}
</script>

<template>
  <div class="master-grocery">
    <div v-if="!Object.keys(masterGroceryList).length" class="master-grocery-empty">
      No ingredients across any submissions yet.
    </div>

    <template v-else>
      <section v-for="(items, aisle) in masterGroceryList" :key="aisle" class="master-grocery-aisle">
        <h3 class="master-grocery-aisle-title">{{ formatAisleTitle(aisle) }}</h3>
        <ul class="master-grocery-list">
          <li
            v-for="item in items"
            :key="item.ingredient.product_id"
            class="master-grocery-row"
          >
            <span class="master-grocery-name truncate">{{ item.ingredient.name }}</span>
            <span class="master-grocery-qty tabular-nums">× {{ item.totalQuantity }}</span>
            <span class="master-grocery-price tabular-nums">
              ${{ ((item.ingredient.price_cents * item.totalQuantity) / 100).toFixed(2) }}
            </span>
          </li>
        </ul>
      </section>

      <div class="master-grocery-total">
        Estimated Total: ${{ (totalCents / 100).toFixed(2) }}
      </div>
    </template>
  </div>
</template>

<style scoped>
.master-grocery {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-30, 1.5rem);
  overflow-y: auto;
  font-size: var(--body-font-size, 1.125rem);
}

.master-grocery-empty {
  font-size: 1rem;
  color: var(--color-lafayette-gray, #3c373c);
}

.master-grocery-aisle {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.master-grocery-aisle-title {
  font-size: clamp(1rem, 1rem + ((1vw - 0.48rem) * 0.3), 1.125rem);
  font-weight: 700;
  color: var(--color-lafayette-gray, #3c373c);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

.master-grocery-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.master-grocery-row {
  display: grid;
  grid-template-columns: 1fr auto 5rem;
  gap: 1rem;
  align-items: center;
  padding: 0.5rem 0;
  font-size: 1rem;
}

.master-grocery-name {
  min-width: 0;
}

.master-grocery-qty {
  color: var(--color-lafayette-gray, #3c373c);
  justify-self: center;
}

.master-grocery-price {
  text-align: right;
  justify-self: end;
}

.master-grocery-total {
  padding-top: var(--spacing-30, 1.5rem);
  border-top: 1px solid var(--color-lafayette-gray, #3c373c);
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--color-lafayette-gray, #3c373c);
  text-align: right;
}
</style>
