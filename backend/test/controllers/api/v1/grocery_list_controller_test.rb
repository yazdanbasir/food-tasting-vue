require "test_helper"

class Api::V1::GroceryListControllerTest < ActionDispatch::IntegrationTest
  setup do
    @organizer = organizers(:admin)
    @organizer.update_column(:token, "valid-test-token-123")
  end

  # ------- SHOW (public) -------

  test "show returns grouped grocery list" do
    get "/api/v1/grocery_list", as: :json
    assert_response :ok
    json = JSON.parse(response.body)
    assert json.key?("aisles")
    assert json.key?("total_cents")
  end

  test "show aggregates quantities across submissions" do
    # apple appears in both team_alpha (qty 3) and team_beta (qty 1)
    get "/api/v1/grocery_list", as: :json
    json = JSON.parse(response.body)
    all_items = json["aisles"].values.flatten
    apple_item = all_items.find { |i| i["ingredient"]["name"] == "Fuji Apple" }
    assert apple_item.present?, "Expected to find Fuji Apple in grocery list"
    assert apple_item["aggregated_quantity"] >= 4
  end

  test "show includes checkin state" do
    GroceryCheckin.create!(ingredient: ingredients(:apple), checked: true, checked_by: "admin")
    get "/api/v1/grocery_list", as: :json
    json = JSON.parse(response.body)
    all_items = json["aisles"].values.flatten
    apple_item = all_items.find { |i| i["ingredient"]["name"] == "Fuji Apple" }
    assert apple_item.present?, "Expected Fuji Apple in grocery list"
    assert_equal true, apple_item["checked"]
    assert_equal "admin", apple_item["checked_by"]
  end

  # ------- CREATE_ITEM (public) -------

  test "create_item adds ingredient to organizer submission" do
    # Ensure clean state for beer in organizer submission
    org_sub = Submission.find_by(team_name: "Organizer", dish_name: "Extra items")
    org_sub&.submission_ingredients&.where(ingredient: ingredients(:beer))&.destroy_all

    post "/api/v1/grocery_list/items", params: {
      ingredient_id: ingredients(:beer).id, quantity: 2
    }, as: :json
    assert_response :created
    json = JSON.parse(response.body)
    assert_equal ingredients(:beer).id, json["ingredient_id"]
    # Default qty (1) + requested qty (2) = 3
    assert_equal 3, json["quantity"]
  end

  test "create_item creates organizer submission if none exists" do
    Submission.where(team_name: "Organizer", dish_name: "Extra items").destroy_all
    post "/api/v1/grocery_list/items", params: {
      ingredient_id: ingredients(:apple).id, quantity: 1
    }, as: :json
    assert_response :created
    assert Submission.exists?(team_name: "Organizer", dish_name: "Extra items")
  end

  test "create_item returns 404 for unknown ingredient" do
    post "/api/v1/grocery_list/items", params: {
      ingredient_id: 999999, quantity: 1
    }, as: :json
    assert_response :not_found
  end

  # ------- UPDATE (public) -------

  test "update checks an ingredient" do
    patch "/api/v1/grocery_list/#{ingredients(:apple).id}", params: {
      checked: true
    }, as: :json
    assert_response :ok
    json = JSON.parse(response.body)
    assert_equal true, json["checked"]
  end

  test "update unchecks an ingredient" do
    GroceryCheckin.create!(ingredient: ingredients(:apple), checked: true, checked_by: "admin")
    patch "/api/v1/grocery_list/#{ingredients(:apple).id}", params: {
      checked: false
    }, as: :json
    assert_response :ok
    json = JSON.parse(response.body)
    assert_equal false, json["checked"]
    assert_nil json["checked_by"]
  end

  test "update changes quantity override" do
    patch "/api/v1/grocery_list/#{ingredients(:apple).id}", params: {
      quantity: 10
    }, as: :json
    assert_response :ok
    json = JSON.parse(response.body)
    assert_equal 10, json["quantity_override"]
  end

  # ------- MASTER_LIST_CHECK (auth required) -------

  test "master_list_check requires auth" do
    post "/api/v1/grocery_list/master_list_check", params: {
      list_type: "other_stores", label: "Item 1", checked: true
    }, as: :json
    assert_response :unauthorized
  end

  test "master_list_check creates checked notification" do
    assert_difference "Notification.count", 1 do
      post "/api/v1/grocery_list/master_list_check", params: {
        list_type: "other_stores", label: "Spice Box", checked: true
      }, headers: auth_headers, as: :json
    end
    assert_response :ok
    n = Notification.last
    assert_includes n.title, "OTHER STORES"
    assert_includes n.title, "CHECKED"
  end

  test "master_list_check rejects invalid list_type" do
    post "/api/v1/grocery_list/master_list_check", params: {
      list_type: "invalid", label: "X", checked: true
    }, headers: auth_headers, as: :json
    assert_response :unprocessable_entity
  end

  private

  def auth_headers
    { "Authorization" => "Bearer valid-test-token-123" }
  end
end
