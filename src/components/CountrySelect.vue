<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useSubmissionStore } from '@/stores/submission'
import { COUNTRIES, flagEmoji } from '@/data/countries'

const { countryCode } = storeToRefs(useSubmissionStore())
const open = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)
const buttonRef = ref<HTMLElement | null>(null)
const dropdownStyle = ref<Record<string, string>>({})
const countrySearchQuery = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)

const selectedLabel = computed(() => {
  if (!countryCode.value) return 'Country'
  const c = COUNTRIES.find((x) => x.code === countryCode.value)
  return c ? `${flagEmoji(c.code)} ${c.name}` : 'Country'
})

const filteredCountries = computed(() => {
  const q = countrySearchQuery.value.trim().toLowerCase()
  if (!q) return COUNTRIES
  return COUNTRIES.filter((c) => c.name.toLowerCase().startsWith(q))
})

watch(open, async (isOpen) => {
  if (!isOpen) {
    countrySearchQuery.value = ''
  } else {
    await nextTick()
    searchInputRef.value?.focus()
  }
})

function toggle() {
  open.value = !open.value
  if (open.value) {
    nextTick(() => {
      if (buttonRef.value) {
        const rect = buttonRef.value.getBoundingClientRect()
        const dropdownWidth = Math.min(352, window.innerWidth * 0.95)
        // Clamp left so the dropdown doesn't overflow the right edge
        const left = Math.min(rect.left, window.innerWidth - dropdownWidth - 8)
        dropdownStyle.value = {
          position: 'fixed',
          top: `${rect.bottom + 4}px`,
          left: `${Math.max(8, left)}px`,
        }
      }
    })
  }
}

function select(code: string) {
  countryCode.value = code
  open.value = false
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as Node
  if (open.value && dropdownRef.value && !dropdownRef.value.contains(target) && buttonRef.value && !buttonRef.value.contains(target)) {
    open.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="country-select-wrap">
    <button
      ref="buttonRef"
      type="button"
      class="country-select-btn"
      :class="{ 'country-select-btn--placeholder': !countryCode }"
      aria-haspopup="listbox"
      :aria-expanded="open"
      @click="toggle"
    >
      {{ selectedLabel }}
      <span
        class="country-select-chevron"
        :class="{ 'country-select-chevron-open': open }"
        aria-hidden="true"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </span>
    </button>
    <Teleport to="body">
      <div
        v-show="open"
        ref="dropdownRef"
        class="country-select-dropdown"
        :style="dropdownStyle"
        role="listbox"
        tabindex="-1"
      >
      <div class="country-select-search-wrap">
        <input
          ref="searchInputRef"
          v-model="countrySearchQuery"
          type="text"
          autocomplete="off"
          placeholder="Search countries..."
          class="search-input"
          aria-label="Search countries"
        />
      </div>
      <button
        v-for="c in filteredCountries"
        :key="c.code"
        type="button"
        role="option"
        class="country-select-option"
        :aria-selected="countryCode === c.code"
        @click="select(c.code)"
      >
        {{ flagEmoji(c.code) }} {{ c.name }}
      </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.country-select-wrap {
  position: relative;
  display: inline-block;
  width: max-content;
  min-width: 0;
}

.country-select-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.25rem 1rem;
  min-height: 2.5rem;
  border: none;
  border-radius: 9999px;
  background: transparent;
  color: #3c373c !important;
  font: inherit;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  outline: none;
}

.country-select-btn--placeholder {
  color: #3c373c !important;
  opacity: 0.7;
}

.country-select-btn:hover {
  opacity: 0.85;
}

.country-select-btn:focus-visible {
  outline: none;
}

.country-select-chevron {
  display: inline-flex;
  flex-shrink: 0;
  color: inherit;
  opacity: 0.82;
  transition: transform 0.2s;
}
.country-select-chevron-open {
  transform: rotate(180deg);
}
</style>

<style>
.country-select-dropdown {
  min-width: 18rem;
  width: max-content;
  max-width: min(22rem, 95vw);
  max-height: 36rem;
  overflow-y: auto;
  background: #fff;
  color: #3c373c;
  border: 1px solid var(--color-lafayette-gray, #3c373c);
  border-radius: 0.75rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  padding: 0.25rem 0;
  outline: none;
}

.country-select-search-wrap {
  padding: 0.25rem 0.5rem 0.5rem;
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 1;
}

/* Same as IngredientSearch / other app search bars */
.country-select-dropdown .search-input {
  width: 100%;
  background: #fff;
  border-radius: 9999px;
  padding: 0.25rem 1rem;
  min-height: 2.5rem;
  outline: none;
  border: none;
  font-size: inherit;
  font-family: inherit;
}

.country-select-dropdown .search-input::placeholder {
  color: var(--color-lafayette-gray, #3c373c);
  opacity: 0.7;
}

.country-select-option {
  display: block;
  width: 100%;
  padding: 0.5rem 1rem;
  border: none;
  background: none;
  color: #3c373c !important;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.1s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.country-select-option:hover {
  background-color: rgba(107, 15, 42, 0.08);
}

.country-select-option[aria-selected="true"] {
  background-color: rgba(107, 15, 42, 0.12);
  font-weight: 500;
}
</style>
