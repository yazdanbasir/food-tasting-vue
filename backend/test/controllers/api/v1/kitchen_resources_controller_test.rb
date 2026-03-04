require "test_helper"

class Api::V1::KitchenResourcesControllerTest < ActionDispatch::IntegrationTest
  setup do
    @organizer = organizers(:admin)
    @organizer.update_column(:token, "valid-test-token-123")
  end

  # ------- INDEX (public) -------

  test "index returns all resources without auth" do
    get "/api/v1/kitchen_resources", as: :json
    assert_response :ok
    json = JSON.parse(response.body)
    assert_kind_of Array, json
    assert json.length >= 4
    assert json.first.key?("kind")
    assert json.first.key?("name")
  end

  # ------- CREATE (auth required) -------

  test "create requires auth" do
    post "/api/v1/kitchen_resources", params: {
      kind: "kitchen", name: "New Kitchen"
    }, as: :json
    assert_response :unauthorized
  end

  test "create adds a new resource" do
    assert_difference "KitchenResource.count", 1 do
      post "/api/v1/kitchen_resources", params: {
        kind: "fridge", name: "New Fridge"
      }, headers: auth_headers, as: :json
    end
    assert_response :created
    json = JSON.parse(response.body)
    assert_equal "fridge", json["kind"]
    assert_equal "New Fridge", json["name"]
  end

  test "create assigns auto-incremented position" do
    max_pos = KitchenResource.where(kind: "kitchen").maximum(:position) || 0
    post "/api/v1/kitchen_resources", params: {
      kind: "kitchen", name: "Auto Pos"
    }, headers: auth_headers, as: :json
    assert_response :created
    json = JSON.parse(response.body)
    assert_equal max_pos + 1, json["position"]
  end

  test "create fails with invalid kind" do
    post "/api/v1/kitchen_resources", params: {
      kind: "invalid", name: "Bad Kind"
    }, headers: auth_headers, as: :json
    assert_response :unprocessable_entity
  end

  # ------- UPDATE (auth required) -------

  test "update requires auth" do
    kr = kitchen_resources(:fridge_one)
    patch "/api/v1/kitchen_resources/#{kr.id}", params: {
      name: "Updated"
    }, as: :json
    assert_response :unauthorized
  end

  test "update changes resource" do
    kr = kitchen_resources(:fridge_one)
    patch "/api/v1/kitchen_resources/#{kr.id}", params: {
      name: "Updated Fridge", point_person: "John"
    }, headers: auth_headers, as: :json
    assert_response :ok
    kr.reload
    assert_equal "Updated Fridge", kr.name
    assert_equal "John", kr.point_person
  end

  # ------- DESTROY (auth required) -------

  test "destroy requires auth" do
    kr = kitchen_resources(:fridge_one)
    delete "/api/v1/kitchen_resources/#{kr.id}", as: :json
    assert_response :unauthorized
  end

  test "destroy removes resource" do
    kr = kitchen_resources(:fridge_one)
    assert_difference "KitchenResource.count", -1 do
      delete "/api/v1/kitchen_resources/#{kr.id}", headers: auth_headers, as: :json
    end
    assert_response :no_content
  end

  test "destroy returns 404 for missing resource" do
    delete "/api/v1/kitchen_resources/999999", headers: auth_headers, as: :json
    assert_response :not_found
  end

  private

  def auth_headers
    { "Authorization" => "Bearer valid-test-token-123" }
  end
end
