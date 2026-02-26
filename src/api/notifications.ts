import { organizerHeaders } from '@/api/organizer'

const BASE = import.meta.env.VITE_API_BASE_URL

export interface NotificationItem {
  id: number
  event_type: string
  title: string
  message: string | null
  read: boolean
  created_at: string
}

export async function fetchNotifications(): Promise<NotificationItem[]> {
  const res = await fetch(`${BASE}/api/v1/notifications`, { headers: organizerHeaders() })
  if (!res.ok) throw new Error(`Failed to load notifications: ${res.status}`)
  return res.json()
}

export async function markAllNotificationsRead(): Promise<void> {
  const res = await fetch(`${BASE}/api/v1/notifications/mark_all_read`, {
    method: 'PATCH',
    headers: organizerHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to mark notifications read: ${res.status}`)
}
