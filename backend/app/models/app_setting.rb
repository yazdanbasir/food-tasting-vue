class AppSetting < ApplicationRecord
  def self.current
    first_or_create!(submissions_locked: false)
  end
end
