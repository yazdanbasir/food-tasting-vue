class AppSetting < ApplicationRecord
  after_commit :bust_cache

  def self.current
    Rails.cache.fetch("app_setting") { first_or_create!(submissions_locked: false) }
  end

  private

  def bust_cache
    Rails.cache.delete("app_setting")
  end
end
