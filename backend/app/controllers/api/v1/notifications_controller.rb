class Api::V1::NotificationsController < ApplicationController
  include OrganizerAuthenticatable

  # GET /api/v1/notifications
  def index
    render json: Notification.recent.map(&:to_broadcast_json)
  end

  # PATCH /api/v1/notifications/mark_all_read
  def mark_all_read
    Notification.unread.update_all(read: true)
    render json: { ok: true }
  end
end
