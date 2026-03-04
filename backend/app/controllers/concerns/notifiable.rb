module Notifiable
  extend ActiveSupport::Concern

  NOTIFICATIONS_CHANNEL = "notifications"

  private

  def create_and_broadcast_notification(event_type:, title:, message: nil)
    n = Notification.create!(event_type: event_type, title: title, message: message)
    ActionCable.server.broadcast(NOTIFICATIONS_CHANNEL, {
      type: event_type,
      notification: n.to_broadcast_json
    })
    n
  end
end
