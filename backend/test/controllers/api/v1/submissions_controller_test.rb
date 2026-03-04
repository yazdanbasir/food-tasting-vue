require "test_helper"

class Api::V1::SubmissionsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @organizer = organizers(:admin)
    @organizer.update_column(:token, "valid-test-token-123")
  end

  # ------- CREATE -------

  test "create submission with valid params" do
    assert_difference "Submission.count", 1 do
      post "/api/v1/submissions", params: {
        dish_name: "New Dish",
        team_name: "New Team",
        has_cooking_place: true,
        members: ["Alice"],
        ingredients: [{ ingredient_id: ingredients(:apple).id, quantity: 2 }]
      }, as: :json
    end
    assert_response :created
    json = JSON.parse(response.body)
    assert_equal "New Dish", json["submission"]["dish_name"]
    assert_equal 1, json["submission"]["ingredients"].length
  end

  test "create submission without ingredients" do
    assert_difference "Submission.count", 1 do
      post "/api/v1/submissions", params: {
        dish_name: "Plain Dish", team_name: "Solo"
      }, as: :json
    end
    assert_response :created
  end

  test "create submission fails with missing dish_name" do
    post "/api/v1/submissions", params: {
      team_name: "No Dish Team"
    }, as: :json
    assert_response :unprocessable_entity
    assert JSON.parse(response.body)["error"].present?
  end

  test "create submission fails with missing team_name" do
    post "/api/v1/submissions", params: {
      dish_name: "No Team Dish"
    }, as: :json
    assert_response :unprocessable_entity
    assert JSON.parse(response.body)["error"].present?
  end

  test "create submission fails when form is locked for students" do
    AppSetting.current.update!(submissions_locked: true)
    post "/api/v1/submissions", params: {
      dish_name: "Locked", team_name: "Locked Team"
    }, as: :json
    assert_response :forbidden
    json = JSON.parse(response.body)
    assert_equal "submissions_locked", json["code"]
    AppSetting.current.update!(submissions_locked: false)
  end

  test "create submission works for organizer when form locked" do
    AppSetting.current.update!(submissions_locked: true)
    assert_difference "Submission.count", 1 do
      post "/api/v1/submissions", params: {
        dish_name: "Org Dish", team_name: "Org Team"
      }, headers: auth_headers, as: :json
    end
    assert_response :created
    AppSetting.current.update!(submissions_locked: false)
  end

  test "create submission creates notification" do
    assert_difference "Notification.count", 1 do
      post "/api/v1/submissions", params: {
        dish_name: "Notify Dish", team_name: "Team N", members: ["Alice"]
      }, as: :json
    end
    n = Notification.last
    assert_equal "new_submission", n.event_type
    assert_includes n.title, "Notify Dish"
  end

  # ------- UPDATE -------

  test "update submission changes attributes" do
    sub = submissions(:team_alpha)
    patch "/api/v1/submissions/#{sub.id}", params: {
      dish_name: "Updated Dish",
      team_name: sub.team_name,
      ingredients: sub.submission_ingredients.map { |si| { ingredient_id: si.ingredient_id, quantity: si.quantity } }
    }, as: :json
    assert_response :ok
    json = JSON.parse(response.body)
    assert_equal "Updated Dish", json["dish_name"]
  end

  test "update submission preserves members when not provided" do
    sub = submissions(:team_alpha)
    sub.update!(members: ["Alice", "Bob"])
    patch "/api/v1/submissions/#{sub.id}", params: {
      dish_name: "Same Members",
      team_name: sub.team_name,
      ingredients: []
    }, as: :json
    assert_response :ok
    sub.reload
    assert_equal ["Alice", "Bob"], sub.members
  end

  test "update submission adds and removes ingredients" do
    sub = submissions(:team_alpha)
    new_ingredient = ingredients(:beer)
    patch "/api/v1/submissions/#{sub.id}", params: {
      dish_name: sub.dish_name,
      team_name: sub.team_name,
      ingredients: [{ ingredient_id: new_ingredient.id, quantity: 1 }]
    }, as: :json
    assert_response :ok
    sub.reload
    assert_equal [new_ingredient.id], sub.submission_ingredients.pluck(:ingredient_id)
  end

  test "update creates notification" do
    sub = submissions(:team_alpha)
    assert_difference "Notification.count", 1 do
      patch "/api/v1/submissions/#{sub.id}", params: {
        dish_name: sub.dish_name,
        team_name: sub.team_name,
        ingredients: sub.submission_ingredients.map { |si| { ingredient_id: si.ingredient_id, quantity: si.quantity } }
      }, as: :json
    end
  end

  test "update submission fails when locked for students" do
    AppSetting.current.update!(submissions_locked: true)
    sub = submissions(:team_alpha)
    patch "/api/v1/submissions/#{sub.id}", params: { dish_name: "Locked", team_name: sub.team_name }, as: :json
    assert_response :forbidden
    AppSetting.current.update!(submissions_locked: false)
  end

  # ------- KITCHEN ALLOCATION -------

  test "kitchen_allocation requires organizer auth" do
    sub = submissions(:team_alpha)
    patch "/api/v1/submissions/#{sub.id}/kitchen_allocation", params: {
      cooking_location: "Kitchen A"
    }, as: :json
    assert_response :unauthorized
  end

  test "kitchen_allocation updates fields" do
    sub = submissions(:team_alpha)
    patch "/api/v1/submissions/#{sub.id}/kitchen_allocation", params: {
      cooking_location: "Kitchen A", equipment_allocated: "Stove", fridge_location: "Fridge 1"
    }, headers: auth_headers, as: :json
    assert_response :ok
    sub.reload
    assert_equal "Kitchen A", sub.cooking_location
    assert_equal "Stove", sub.equipment_allocated
    assert_equal "Fridge 1", sub.fridge_location
  end

  # ------- DESTROY -------

  test "destroy requires organizer auth" do
    sub = submissions(:team_alpha)
    delete "/api/v1/submissions/#{sub.id}", as: :json
    assert_response :unauthorized
  end

  test "destroy removes submission" do
    sub = submissions(:team_alpha)
    assert_difference "Submission.count", -1 do
      delete "/api/v1/submissions/#{sub.id}", headers: auth_headers, as: :json
    end
    assert_response :no_content
  end

  test "destroy creates notification" do
    sub = submissions(:team_alpha)
    assert_difference "Notification.count", 1 do
      delete "/api/v1/submissions/#{sub.id}", headers: auth_headers, as: :json
    end
  end

  # ------- INDEX -------

  test "index returns all submissions" do
    get "/api/v1/submissions", as: :json
    assert_response :ok
    json = JSON.parse(response.body)
    assert_kind_of Array, json
    assert json.length >= 2
  end

  test "index includes ingredients in response" do
    get "/api/v1/submissions", as: :json
    json = JSON.parse(response.body)
    sub_with_ingredients = json.find { |s| s["ingredients"].any? }
    assert sub_with_ingredients.present?
    assert sub_with_ingredients["ingredients"].first.key?("ingredient")
  end

  # ------- LOOKUP -------

  test "lookup finds submission by phone number" do
    sub = submissions(:team_alpha)
    sub.update!(phone_number: "555-123-4567")
    get "/api/v1/submissions/lookup", params: { phone: "5551234567" }
    assert_response :ok
    json = JSON.parse(response.body)
    assert_equal sub.id, json["submission"]["id"]
  end

  test "lookup returns 404 for unknown phone" do
    get "/api/v1/submissions/lookup", params: { phone: "0000000000" }
    assert_response :not_found
  end

  test "lookup returns 422 for blank phone" do
    get "/api/v1/submissions/lookup", params: { phone: "" }
    assert_response :unprocessable_entity
  end

  private

  def auth_headers
    { "Authorization" => "Bearer valid-test-token-123" }
  end
end
