require "test_helper"

class Api::V1::NotificationsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @organizer = organizers(:admin)
    @organizer.update_column(:token, "valid-test-token-123")
  end

  test "index requires auth" do
    get "/api/v1/notifications", as: :json
    assert_response :unauthorized
  end

  test "index returns recent notifications" do
    get "/api/v1/notifications", headers: auth_headers, as: :json
    assert_response :ok
    json = JSON.parse(response.body)
    assert_kind_of Array, json
    assert json.any? { |n| n["event_type"] == "new_submission" }
  end

  test "mark_all_read marks all unread notifications as read" do
    assert Notification.unread.count > 0
    patch "/api/v1/notifications/mark_all_read", headers: auth_headers, as: :json
    assert_response :ok
    assert_equal 0, Notification.unread.count
  end

  test "mark_all_read requires auth" do
    patch "/api/v1/notifications/mark_all_read", as: :json
    assert_response :unauthorized
  end

  private

  def auth_headers
    { "Authorization" => "Bearer valid-test-token-123" }
  end
end
