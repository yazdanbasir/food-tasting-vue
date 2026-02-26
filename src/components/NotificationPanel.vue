<script setup lang="ts">
import '@/styles/form-section.css'
import { ref, watch, nextTick } from 'vue'
import { useNotificationStore } from '@/stores/notifications'

const store = useNotificationStore()
const panelRef = ref<HTMLElement | null>(null)

function relativeTime(dateStr: string): string {
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  return `${Math.floor(diffSec / 86400)}d ago`
}

function dotColor(eventType: string): string {
  if (eventType.startsWith('new_submission') || eventType.startsWith('submission')) return '#910029'
  if (eventType.startsWith('ingredient')) return '#006690'
  return '#059669'
}

function handleDocClick(e: MouseEvent) {
  if (panelRef.value && !panelRef.value.contains(e.target as Node)) {
    store.closePanel()
  }
}

watch(() => store.panelOpen, (open) => {
  if (open) {
    nextTick(() => document.addEventListener('click', handleDocClick))
  } else {
    document.removeEventListener('click', handleDocClick)
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="notif-slide">
      <div v-if="store.panelOpen" ref="panelRef" class="notif-panel">
        <div class="notif-panel-header">
          <span class="notif-panel-title">Notifications</span>
          <button
            v-if="store.unreadCount > 0"
            type="button"
            class="btn-pill-secondary notif-mark-btn"
            @click="store.markAllRead()"
          >Mark all read</button>
        </div>

        <div class="notif-list">
          <p v-if="!store.notifications.length" class="notif-empty">No notifications yet.</p>
          <div
            v-for="n in store.notifications"
            :key="n.id"
            class="notif-item"
            :class="{ 'notif-item-unread': !n.read }"
          >
            <div class="notif-dot" :style="{ background: dotColor(n.event_type) }" />
            <div class="notif-body">
              <div class="notif-title">{{ n.title }}</div>
              <div v-if="n.message" class="notif-message">{{ n.message }}</div>
              <div class="notif-time">{{ relativeTime(n.created_at) }}</div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.notif-panel {
  position: fixed;
  top: 5rem;
  right: 1rem;
  width: 22rem;
  max-height: 32rem;
  background: #fff;
  border: 1px solid var(--color-lafayette-gray, #3c373c);
  border-radius: 0.875rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  z-index: 2000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.notif-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem 0.75rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
}

.notif-panel-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-lafayette-gray, #3c373c);
}

.notif-mark-btn {
  font-size: 0.875rem;
  padding: 0.25rem 0.875rem;
  min-height: 2rem;
}

.notif-list {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.notif-empty {
  padding: 1.25rem 1rem;
  font-size: 1rem;
  color: var(--color-lafayette-gray, #3c373c);
  opacity: 0.55;
  margin: 0;
}

.notif-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-left: 3px solid transparent;
  transition: background-color 0.1s;
}

.notif-item + .notif-item {
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.notif-item:hover {
  background: rgba(0, 0, 0, 0.025);
}

.notif-item-unread {
  border-left-color: var(--color-lafayette-red, #910029);
  background: rgba(145, 0, 41, 0.03);
}

.notif-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  flex-shrink: 0;
  margin-top: 0.375rem;
}

.notif-body {
  flex: 1;
  min-width: 0;
}

.notif-title {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-lafayette-gray, #3c373c);
  line-height: 1.3;
}

.notif-message {
  font-size: 0.875rem;
  color: var(--color-lafayette-gray, #3c373c);
  opacity: 0.65;
  margin-top: 0.125rem;
  line-height: 1.3;
}

.notif-time {
  font-size: 0.8125rem;
  color: var(--color-lafayette-gray, #3c373c);
  opacity: 0.45;
  margin-top: 0.25rem;
}

.notif-slide-enter-active,
.notif-slide-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.notif-slide-enter-from,
.notif-slide-leave-to {
  opacity: 0;
  transform: translateY(-0.375rem);
}
</style>
