require "test_helper"

class Api::V1::FormLockControllerTest < ActionDispatch::IntegrationTest
  setup do
    @organizer = organizers(:admin)
    @organizer.update_column(:token, "valid-test-token-123")
  end

  test "show returns lock state without auth" do
    get "/api/v1/form_lock", as: :json
    assert_response :ok
    json = JSON.parse(response.body)
    assert json.key?("submissions_locked")
  end

  test "update requires auth" do
    patch "/api/v1/form_lock", params: {
      submissions_locked: true
    }, as: :json
    assert_response :unauthorized
  end

  test "update locks submissions" do
    patch "/api/v1/form_lock", params: {
      submissions_locked: true
    }, headers: auth_headers, as: :json
    assert_response :ok
    json = JSON.parse(response.body)
    assert_equal true, json["submissions_locked"]
    # Restore
    AppSetting.current.update!(submissions_locked: false)
  end

  test "update unlocks submissions" do
    AppSetting.current.update!(submissions_locked: true)
    patch "/api/v1/form_lock", params: {
      submissions_locked: false
    }, headers: auth_headers, as: :json
    assert_response :ok
    json = JSON.parse(response.body)
    assert_equal false, json["submissions_locked"]
  end

  private

  def auth_headers
    { "Authorization" => "Bearer valid-test-token-123" }
  end
end
