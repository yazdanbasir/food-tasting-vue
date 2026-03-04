require "test_helper"

class AppSettingTest < ActiveSupport::TestCase
  test "current returns existing setting" do
    setting = AppSetting.current
    assert_not_nil setting
    assert_instance_of AppSetting, setting
  end

  test "current creates setting if none exists" do
    AppSetting.delete_all
    Rails.cache.clear
    setting = AppSetting.current
    assert_not_nil setting
    assert_equal false, setting.submissions_locked
  end

  test "current caches the result" do
    Rails.cache.clear
    first_call = AppSetting.current
    second_call = AppSetting.current
    assert_equal first_call.id, second_call.id
  end

  test "bust_cache clears cache on update" do
    setting = AppSetting.current
    setting.update!(submissions_locked: true)
    # After cache bust, current should return fresh value
    refreshed = AppSetting.current
    assert_equal true, refreshed.submissions_locked
    # Restore
    setting.update!(submissions_locked: false)
  end
end
