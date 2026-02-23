<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { createConsumer } from '@rails/actioncable'
import { getAllSubmissions, type SubmissionResponse } from '@/api/submissions'
import { getGroceryList, checkGroceryItem, updateGroceryQuantity, organizerLogout, type GroceryListResponse, type GroceryItem } from '@/api/organizer'

const router = useRouter()
const token = localStorage.getItem('organizer_token') ?? ''
const organizerUsername = localStorage.getItem('organizer_username') ?? ''

const activeTab = ref<'submissions' | 'grocery'>('submissions')
const submissions = ref<SubmissionResponse[]>([])
const groceryList = ref<GroceryListResponse | null>(null)
const expandedSubmission = ref<number | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)

// Action Cable consumer
const cable = createConsumer(`${import.meta.env.VITE_API_BASE_URL.replace(/^http/, 'ws')}/cable`)
let grocerySubscription: ReturnType<typeof cable.subscriptions.create> | null = null

onMounted(async () => {
  await loadSubmissions()

  // Subscribe to real-time grocery list updates
  grocerySubscription = cable.subscriptions.create('GroceryListChannel', {
    received(data: { ingredient_id: number; checked: boolean; checked_by: string | null; checked_at: string | null }) {
      if (!groceryList.value) return
      for (const items of Object.values(groceryList.value.aisles)) {
        const item = items.find((i) => i.ingredient.id === data.ingredient_id)
        if (item) {
          item.checked = data.checked
          item.checked_by = data.checked_by
          item.checked_at = data.checked_at
          break
        }
      }
    },
  })

  // Subscribe to submission notifications
  cable.subscriptions.create('NotificationsChannel', {
    received() {
      loadSubmissions()
      if (groceryList.value) loadGroceryList()
    },
  })
})

onUnmounted(() => {
  cable.disconnect()
})

async function loadSubmissions() {
  isLoading.value = true
  error.value = null
  try {
    submissions.value = await getAllSubmissions(token)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load'
  } finally {
    isLoading.value = false
  }
}

async function loadGroceryList() {
  isLoading.value = true
  error.value = null
  try {
    groceryList.value = await getGroceryList(token)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load'
  } finally {
    isLoading.value = false
  }
}

async function switchToGrocery() {
  activeTab.value = 'grocery'
  if (!groceryList.value) await loadGroceryList()
}

async function toggleCheck(item: GroceryItem) {
  const newChecked = !item.checked
  item.checked = newChecked
  try {
    await checkGroceryItem(token, item.ingredient.id, newChecked)
  } catch {
    item.checked = !newChecked
  }
}

async function changeQuantity(item: GroceryItem, delta: number) {
  const newQty = Math.max(1, item.total_quantity + delta)
  const prev = item.total_quantity
  item.total_quantity = newQty
  try {
    await updateGroceryQuantity(token, item.ingredient.id, newQty)
  } catch {
    item.total_quantity = prev
  }
}

function handleAuthFailure() {
  localStorage.removeItem('organizer_token')
  localStorage.removeItem('organizer_username')
  router.push('/organizer/login')
}

async function logout() {
  await organizerLogout(token)
  handleAuthFailure()
}

const totalCents = computed(() => {
  if (!groceryList.value) return 0
  return groceryList.value.total_cents
})
</script>

<template>
  <div class="h-full flex flex-col text-[17px]">
    <!-- Header -->
    <div class="flex items-center gap-4 px-6 py-4 border-b border-gray-200">
      <div class="flex gap-2">
        <button
          class="rounded-full px-4 py-1 min-h-8 transition-colors"
          :class="activeTab === 'submissions' ? 'bg-black text-white' : 'bg-[#ececf1] text-gray-700'"
          @click="activeTab = 'submissions'"
        >
          submissions
        </button>
        <button
          class="rounded-full px-4 py-1 min-h-8 transition-colors"
          :class="activeTab === 'grocery' ? 'bg-black text-white' : 'bg-[#ececf1] text-gray-700'"
          @click="switchToGrocery"
        >
          grocery list
        </button>
      </div>
      <span class="flex-1 text-sm text-gray-400">{{ organizerUsername }}</span>
      <button
        class="text-sm text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
        @click="logout"
      >
        sign out
      </button>
    </div>

    <!-- Body -->
    <div class="flex-1 overflow-y-auto px-6 py-4 min-h-0">
      <div v-if="isLoading && !submissions.length && !groceryList" class="text-sm text-gray-400">
        loading...
      </div>
      <div v-else-if="error" class="text-sm text-red-500">{{ error }}</div>

      <!-- Submissions Tab -->
      <div v-else-if="activeTab === 'submissions'">
        <div v-if="!submissions.length" class="text-sm text-gray-400">No submissions yet.</div>
        <div v-else class="flex flex-col gap-3">
          <div
            v-for="sub in submissions"
            :key="sub.id"
            class="bg-[#ececf1] rounded-2xl overflow-hidden"
          >
            <!-- Row -->
            <button
              class="w-full flex items-center gap-4 px-5 py-4 text-left cursor-pointer hover:opacity-80 transition-opacity"
              @click="expandedSubmission = expandedSubmission === sub.id ? null : sub.id"
            >
              <div class="flex-1 min-w-0">
                <div class="font-medium">{{ sub.team_name }}</div>
                <div class="text-sm text-gray-500">{{ sub.dish_name }}</div>
              </div>
              <div class="text-sm text-gray-400 flex-none">
                {{ sub.ingredients.length }} item{{ sub.ingredients.length !== 1 ? 's' : '' }}
              </div>
              <div class="text-sm text-gray-400 flex-none">
                {{ new Date(sub.submitted_at).toLocaleDateString() }}
              </div>
              <div class="text-gray-400 flex-none">{{ expandedSubmission === sub.id ? '▲' : '▼' }}</div>
            </button>

            <!-- Expanded detail -->
            <div v-if="expandedSubmission === sub.id" class="px-5 pb-4 border-t border-gray-200">
              <ul class="divide-y divide-gray-200">
                <li
                  v-for="item in sub.ingredients"
                  :key="item.ingredient.product_id"
                  class="flex items-center gap-3 py-2 text-sm"
                >
                  <span class="flex-1">{{ item.ingredient.name }}</span>
                  <span class="text-gray-400">{{ item.ingredient.size }}</span>
                  <span class="tabular-nums w-8 text-center">× {{ item.quantity }}</span>
                  <span class="tabular-nums w-16 text-right">
                    ${{ ((item.ingredient.price_cents * item.quantity) / 100).toFixed(2) }}
                  </span>
                </li>
              </ul>
              <div v-if="sub.notes" class="mt-2 text-sm text-gray-500 italic">{{ sub.notes }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Grocery List Tab -->
      <div v-else-if="activeTab === 'grocery' && groceryList">
        <div class="flex flex-col gap-6">
          <div v-for="(items, aisle) in groceryList.aisles" :key="aisle">
            <div class="text-sm font-medium text-gray-500 mb-2">{{ aisle }}</div>
            <div class="flex flex-col gap-1">
              <div
                v-for="item in items"
                :key="item.ingredient.id"
                class="flex items-center gap-3 bg-[#ececf1] rounded-xl px-4 py-3 transition-opacity"
                :class="item.checked ? 'opacity-50' : ''"
              >
                <input
                  type="checkbox"
                  :checked="item.checked"
                  class="w-4 h-4 cursor-pointer flex-none"
                  @change="toggleCheck(item)"
                />
                <div class="flex-1 min-w-0">
                  <div class="text-sm flex items-center gap-2" :class="item.checked ? 'line-through text-gray-400' : ''">
                    <span>{{ item.ingredient.name }}</span>
                    <span class="text-gray-400">{{ item.ingredient.size }}</span>
                    <span class="flex items-center gap-1 no-underline" style="text-decoration: none;">
                      <button
                        class="w-5 h-5 flex items-center justify-center rounded-full bg-white text-black leading-none hover:opacity-70 transition-opacity cursor-pointer"
                        style="text-decoration: none;"
                        @click.prevent.stop="changeQuantity(item, -1)"
                      >−</button>
                      <span class="tabular-nums w-5 text-center">{{ item.total_quantity }}</span>
                      <button
                        class="w-5 h-5 flex items-center justify-center rounded-full bg-white text-black leading-none hover:opacity-70 transition-opacity cursor-pointer"
                        style="text-decoration: none;"
                        @click.prevent.stop="changeQuantity(item, +1)"
                      >+</button>
                    </span>
                  </div>
                  <div class="text-xs text-gray-400">{{ item.teams.join(', ') }}</div>
                </div>
                <div class="text-sm tabular-nums flex-none">
                  ${{ ((item.ingredient.price_cents * item.total_quantity) / 100).toFixed(2) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Total -->
        <div class="mt-6 pt-4 border-t border-gray-200 flex justify-between text-sm font-medium">
          <span>estimated total</span>
          <span class="tabular-nums">${{ (totalCents / 100).toFixed(2) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
