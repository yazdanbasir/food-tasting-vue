class Api::V1::NotificationsController < ApplicationController
  include OrganizerAuthenticatable

  # GET /api/v1/notifications
  def index
    render json: Notification.recent.map { |n| notification_json(n) }
  end

  # PATCH /api/v1/notifications/mark_all_read
  def mark_all_read
    Notification.unread.update_all(read: true)
    render json: { ok: true }
  end

  private

  def notification_json(n)
    {
      id: n.id,
      event_type: n.event_type,
      title: n.title,
      message: n.message,
      read: n.read,
      created_at: n.created_at
    }
  end
end
