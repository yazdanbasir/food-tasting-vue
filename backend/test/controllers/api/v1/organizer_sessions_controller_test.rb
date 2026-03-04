require "test_helper"

class Api::V1::OrganizerSessionsControllerTest < ActionDispatch::IntegrationTest
  test "create with valid credentials returns token" do
    post "/api/v1/organizer_session", params: {
      username: "admin", password: "testpass123"
    }, as: :json
    assert_response :ok
    json = JSON.parse(response.body)
    assert json["token"].present?
    assert_equal "admin", json["username"]
  end

  test "create with wrong password returns unauthorized" do
    post "/api/v1/organizer_session", params: {
      username: "admin", password: "wrongpassword"
    }, as: :json
    assert_response :unauthorized
    json = JSON.parse(response.body)
    assert_equal "Invalid credentials", json["error"]
  end

  test "create with unknown username returns unauthorized" do
    post "/api/v1/organizer_session", params: {
      username: "unknown_user", password: "testpass123"
    }, as: :json
    assert_response :unauthorized
  end

  test "destroy clears token" do
    organizer = organizers(:admin)
    organizer.update_column(:token, "session-token-to-clear")
    delete "/api/v1/organizer_session", headers: {
      "Authorization" => "Bearer session-token-to-clear"
    }, as: :json
    assert_response :no_content
    assert_nil organizer.reload.token
  end

  test "destroy with no token still returns no_content" do
    delete "/api/v1/organizer_session", as: :json
    assert_response :no_content
  end
end
