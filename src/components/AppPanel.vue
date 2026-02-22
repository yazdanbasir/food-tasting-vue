<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    variant: 'dish-name' | 'group-members' | 'lower' | 'search' | 'upper'
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
</script>

<template>
  <div
    :class="[
      variant === 'search' ? 'events' : `panel panel--${variant}`,
      collapsible && !expanded ? 'panel--collapsed' : '',
    ]"
  >
    <div
      class="panel-title"
      :role="collapsible ? 'button' : undefined"
      :tabindex="collapsible ? 0 : undefined"
      @click="collapsible ? handleTitleClick() : undefined"
      @keydown="collapsible ? handleTitleKeydown($event) : undefined"
    >
      {{ title }}
    </div>
    <div v-if="!collapsible || expanded" class="panel-body">
      <slot />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.events,
[class^='panel'] {
  border-radius: 16px;
  background-color: #ececf1;
  position: relative;
}

.panel-title {
  position: absolute;
  top: 16px;
  left: 16px;
  padding: 4px 16px;
  background-color: #fff;
  border-radius: 1000px;
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  font-size: 17px;

  &[role='button'] {
    cursor: pointer;

    &:hover {
      opacity: 0.8;
    }
  }
}

.panel-body {
  padding: 16px;
  margin-top: 56px;
}

// Search panel (variant="search") uses .events
.events {
  flex: 1 1 50%;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;

  .panel-body {
    display: flex;
    flex-direction: column;
    flex: 1 1 0;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
    padding: 16px;
    box-sizing: border-box;
  }
}

// Base panel
.panel {
  flex: 1;
}

// Variant: upper (grocery list)
.panel--upper {
  flex: 1 1 50%;
  min-width: 0;
  min-height: 0;
}

// Variant: dish-name
.panel--dish-name {
  flex: 0 0 auto;
  min-height: auto;
  min-width: 0;

  .panel-body {
    padding: 12px 16px;
    margin-top: 48px;
    min-width: 0;
    overflow: hidden;
  }
}

// Variant: group-members
.panel--group-members {
  flex: 1;
  min-height: 0;
  min-width: 0;
  box-sizing: border-box;

  .panel-body {
    min-width: 0;
    overflow: hidden;
  }
}

// Variant: lower (recipe)
.panel--lower {
  box-sizing: border-box;
}

// Collapsed state
.panel--collapsed {
  flex: 0 0 auto !important;
  min-height: 0;

  .panel-body {
    display: none;
  }

  .panel-title {
    top: 50%;
    transform: translateY(-50%);
  }

  &.panel--group-members {
    flex: 0 0 auto !important;
    min-height: 64px;
    height: 64px;
  }

  &.panel--lower {
    min-height: 64px;
    height: 64px;
  }
}
</style>
