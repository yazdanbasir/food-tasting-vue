class Notification < ApplicationRecord
  scope :unread, -> { where(read: false) }
  scope :recent, -> { order(created_at: :desc).limit(50) }

  def to_broadcast_json
    {
      id: id,
      event_type: event_type,
      title: title,
      message: message,
      read: read,
      created_at: created_at
    }
  end
end
