class Organizer < ApplicationRecord
  has_secure_password

  validates :username, presence: true, uniqueness: true

  def regenerate_token
    update!(token: SecureRandom.hex(32))
    token
  end

  def clear_token
    update!(token: nil)
  end
end
