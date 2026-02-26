class Notification < ApplicationRecord
  scope :unread, -> { where(read: false) }
  scope :recent, -> { order(created_at: :desc).limit(50) }
end
