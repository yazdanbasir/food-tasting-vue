module Notifiable
  extend ActiveSupport::Concern

  private

  def create_and_broadcast_notification(event_type:, title:, message: nil)
    n = Notification.create!(event_type: event_type, title: title, message: message)
    ActionCable.server.broadcast("notifications", {
      type: event_type,
      notification: {
        id: n.id,
        event_type: n.event_type,
        title: n.title,
        message: n.message,
        read: false,
        created_at: n.created_at
      }
    })
    n
  end
end
