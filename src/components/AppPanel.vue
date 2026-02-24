<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    title: string
    variant: 'country' | 'dish-name' | 'group-members' | 'lower' | 'search' | 'search-slim' | 'upper'
    collapsible?: boolean
    expanded?: boolean
  }>(),
  {
    collapsible: false,
    expanded: true,
  },
)

const emit = defineEmits<{
  toggle: []
}>()

function handleTitleClick() {
  emit('toggle')
}

function handleTitleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    emit('toggle')
  }
}

const isCollapsed = computed(() => props.collapsible && !props.expanded)

const containerClasses = computed(() => {
  const base = ['rounded-2xl', 'bg-[var(--color-menu-gray)]', 'relative']

  if (props.variant === 'search') {
    return [...base, 'flex', 'flex-col', 'min-w-0', 'min-h-0', isCollapsed.value ? 'flex-none' : 'flex-[1_1_50%]']
  }
  // One-line in-flow: [p-4] [pill] [gap-4] [slot] so bar sits 1rem after pill (same as left spacing)
  if (props.variant === 'country' || props.variant === 'dish-name' || props.variant === 'search-slim') {
    return [...base, 'flex', 'flex-row', 'items-center', 'p-4', 'gap-4', 'flex-none', 'min-w-0', 'h-16']
  }
  if (props.variant === 'group-members') {
    if (isCollapsed.value) {
      return [...base, 'flex-none', 'min-w-0', 'h-16', 'min-h-16']
    }
    return [...base, 'flex', 'flex-row', 'items-start', 'p-4', 'gap-4', 'flex-1', 'min-h-0', 'min-w-0']
  }
  if (props.variant === 'lower') {
    if (isCollapsed.value) {
      return [...base, 'flex-none', 'h-16', 'min-h-16']
    }
    return [...base, 'flex-1']
  }
  if (props.variant === 'upper') {
    return [...base, 'flex', 'flex-col', 'min-w-0', 'min-h-0', isCollapsed.value ? 'flex-none' : 'flex-[1_1_50%]']
  }
  return [...base, 'flex-1']
})

const titleClasses = computed(() => {
  const pillBase = ['px-4', 'py-1', 'bg-white', 'rounded-full', 'min-h-8', 'flex', 'items-center', 'justify-center']
  // In-flow pill for country, dish-name, search-slim, and group-members when expanded
  if (['country', 'dish-name', 'search-slim'].includes(props.variant)) {
    return [...pillBase, 'flex-none']
  }
  if (props.variant === 'group-members' && !isCollapsed.value) {
    return [...pillBase, 'flex-none', 'cursor-pointer', 'hover:opacity-80']
  }
  const base = [...pillBase, 'absolute', 'left-4', 'z-10']
  if (props.collapsible) {
    base.push('cursor-pointer', 'hover:opacity-80')
  }
  if (isCollapsed.value) {
    return [...base, 'top-1/2', '-translate-y-1/2']
  }
  return [...base, 'top-4']
})

const bodyClasses = computed(() => {
  if (props.variant === 'search') {
    return ['flex', 'flex-col', 'flex-[1_1_0]', 'min-h-0', 'min-w-0', 'overflow-hidden', 'p-4']
  }
  // country, dish-name, search-slim: slot is second flex child (bar only)
  if (['country', 'dish-name', 'search-slim'].includes(props.variant)) {
    return ['flex-1', 'min-w-0']
  }
  // group-members when expanded: slot has bar + list column
  if (props.variant === 'group-members') {
    return ['flex-1', 'min-w-0', 'flex', 'flex-col', 'min-h-0', 'overflow-hidden']
  }
  if (props.variant === 'upper') {
    return ['flex', 'flex-col', 'flex-1', 'min-h-0', 'overflow-hidden', 'p-4', 'mt-14']
  }
  return ['p-4', 'mt-14']
})
</script>

<template>
  <div :class="containerClasses">
    <div
      :class="titleClasses"
      :role="collapsible ? 'button' : undefined"
      :tabindex="collapsible ? 0 : undefined"
      @click="collapsible ? handleTitleClick() : undefined"
      @keydown="collapsible ? handleTitleKeydown($event) : undefined"
    >
      {{ title }}
    </div>
    <div v-if="!collapsible || expanded" :class="bodyClasses">
      <slot />
    </div>
  </div>
</template>
