import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchNotifications, markAllNotificationsRead, type NotificationItem } from '@/api/notifications'

export const useNotificationStore = defineStore('notifications', () => {
  const notifications = ref<NotificationItem[]>([])
  const panelOpen = ref(false)

  const unreadCount = computed(() => notifications.value.filter((n) => !n.read).length)

  async function load() {
    try {
      notifications.value = await fetchNotifications()
    } catch {
      // organizer may not be logged in yet — silently ignore
    }
  }

  function addFromCable(notification: NotificationItem) {
    // Prepend newest; cap at 50 to match backend's recent scope
    notifications.value = [notification, ...notifications.value.slice(0, 49)]
  }

  async function markAllRead() {
    try {
      await markAllNotificationsRead()
      notifications.value = notifications.value.map((n) => ({ ...n, read: true }))
    } catch {
      // ignore
    }
  }

  function togglePanel() {
    panelOpen.value = !panelOpen.value
  }

  function closePanel() {
    panelOpen.value = false
  }

  return { notifications, unreadCount, panelOpen, load, addFromCable, markAllRead, togglePanel, closePanel }
})
