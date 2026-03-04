require "test_helper"

class Api::V1::IngredientsControllerTest < ActionDispatch::IntegrationTest
  test "all returns every ingredient" do
    get "/api/v1/ingredients/all"
    assert_response :ok
    json = JSON.parse(response.body)
    assert_kind_of Array, json
    assert json.length >= 3
    assert json.first.key?("name")
    assert json.first.key?("price")
    assert json.first.key?("dietary")
  end

  test "index requires at least 2 character query" do
    get "/api/v1/ingredients", params: { q: "a" }
    assert_response :ok
    json = JSON.parse(response.body)
    assert_equal [], json
  end

  test "index returns matching ingredients" do
    get "/api/v1/ingredients", params: { q: "apple" }
    assert_response :ok
    json = JSON.parse(response.body)
    assert json.any? { |i| i["name"] == "Fuji Apple" }
  end

  test "index returns empty for no match" do
    get "/api/v1/ingredients", params: { q: "xyznonexistent" }
    assert_response :ok
    assert_equal [], JSON.parse(response.body)
  end

  test "show returns single ingredient" do
    ing = ingredients(:apple)
    get "/api/v1/ingredients/#{ing.id}"
    assert_response :ok
    json = JSON.parse(response.body)
    assert_equal "Fuji Apple", json["name"]
  end

  test "show returns 404 for missing ingredient" do
    get "/api/v1/ingredients/999999"
    assert_response :not_found
  end
end
