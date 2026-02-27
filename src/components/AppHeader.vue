<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <header class="app-header">
    <div class="app-header-spacer" aria-hidden="true"></div>
    <!-- Center: ISA logo + event name -->
    <div class="app-header-center">
      <img src="/isa-logo.png" alt="ISA" class="app-header-isa" />
      <span class="app-header-event">ISA Food Tasting</span>
    </div>

    <!-- Right: nav links -->
    <div class="app-header-right">
      <RouterLink
        to="/"
        class="app-header-link"
        :class="route.path === '/' ? 'app-header-link-active' : 'app-header-link-inactive'"
      >
        Form
      </RouterLink>
      <RouterLink
        to="/organizer"
        class="app-header-link"
        :class="route.path.startsWith('/organizer') ? 'app-header-link-active' : 'app-header-link-inactive'"
      >
        Manage
      </RouterLink>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  min-height: 3.75rem;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem;
  gap: 1rem;
  background-color: var(--color-lafayette-red, #6b0f2a);
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
}

.app-header-spacer {
  flex: 1;
  min-width: 0;
}

.app-header-center {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  gap: 1.25rem;
}

.app-header-isa {
  height: 2.25rem;
  object-fit: contain;
}

.app-header-event {
  font-size: 1.75rem;
  color: #fff;
  font-weight: 500;
}

.app-header-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  flex: 1;
  justify-content: flex-end;
}

.app-header-link {
  border-radius: 9999px;
  padding: 0.5rem 1.5rem;
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 500;
  transition: background-color 0.15s, color 0.15s;
  text-decoration: none;
  flex: none;
}

.app-header-link-active {
  background-color: #fff;
  color: var(--color-lafayette-red, #6b0f2a);
}

.app-header-link-active:hover {
  background-color: #fff;
  color: var(--color-lafayette-red, #6b0f2a);
}

.app-header-link-active:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

.app-header-link-inactive {
  background-color: transparent;
  color: rgba(255, 255, 255, 0.92);
}

.app-header-link-inactive:hover {
  background-color: rgba(255, 255, 255, 0.18);
  color: #fff;
}

.app-header-link-inactive:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}
</style>
