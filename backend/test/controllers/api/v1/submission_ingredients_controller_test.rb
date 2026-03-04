require "test_helper"

class Api::V1::SubmissionIngredientsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @organizer = organizers(:admin)
    @organizer.update_column(:token, "valid-test-token-123")
    @sub = submissions(:team_alpha)
  end

  # ------- CREATE -------

  test "create adds ingredient to submission" do
    new_ingredient = ingredients(:beer)
    # Beer should not exist on team_alpha yet
    @sub.submission_ingredients.where(ingredient: new_ingredient).destroy_all
    post "/api/v1/submissions/#{@sub.id}/ingredients", params: {
      ingredient_id: new_ingredient.id, quantity: 2
    }, headers: auth_headers, as: :json
    assert_response :ok
    si = @sub.submission_ingredients.find_by(ingredient: new_ingredient)
    # Default qty (1) + requested qty (2) = 3
    assert_equal 3, si.quantity
  end

  test "create increments quantity if ingredient already exists" do
    existing_si = submission_ingredients(:alpha_apple)
    original_qty = existing_si.quantity
    post "/api/v1/submissions/#{@sub.id}/ingredients", params: {
      ingredient_id: ingredients(:apple).id, quantity: 3
    }, headers: auth_headers, as: :json
    assert_response :ok
    assert_equal original_qty + 3, existing_si.reload.quantity
  end

  test "create defaults quantity to 1 when not provided" do
    new_ingredient = ingredients(:beer)
    @sub.submission_ingredients.where(ingredient: new_ingredient).destroy_all
    post "/api/v1/submissions/#{@sub.id}/ingredients", params: {
      ingredient_id: new_ingredient.id
    }, headers: auth_headers, as: :json
    assert_response :ok
    si = @sub.submission_ingredients.find_by(ingredient: new_ingredient)
    # Default qty (1) + defaulted param qty (1) = 2
    assert_equal 2, si.quantity
  end

  test "create returns 404 for missing submission" do
    post "/api/v1/submissions/999999/ingredients", params: {
      ingredient_id: ingredients(:apple).id
    }, headers: auth_headers, as: :json
    assert_response :not_found
  end

  test "create creates notification" do
    assert_difference "Notification.count", 1 do
      post "/api/v1/submissions/#{@sub.id}/ingredients", params: {
        ingredient_id: ingredients(:beer).id, quantity: 1
      }, headers: auth_headers, as: :json
    end
  end

  # ------- UPDATE -------

  test "update changes ingredient quantity" do
    si = submission_ingredients(:alpha_apple)
    patch "/api/v1/submissions/#{@sub.id}/ingredients/#{ingredients(:apple).id}", params: {
      quantity: 10
    }, headers: auth_headers, as: :json
    assert_response :ok
    assert_equal 10, si.reload.quantity
  end

  test "update removes ingredient when quantity is 0" do
    assert_difference "SubmissionIngredient.count", -1 do
      patch "/api/v1/submissions/#{@sub.id}/ingredients/#{ingredients(:apple).id}", params: {
        quantity: 0
      }, headers: auth_headers, as: :json
    end
    assert_response :ok
  end

  test "update returns 404 for missing ingredient" do
    patch "/api/v1/submissions/#{@sub.id}/ingredients/999999", params: {
      quantity: 5
    }, headers: auth_headers, as: :json
    assert_response :not_found
  end

  private

  def auth_headers
    { "Authorization" => "Bearer valid-test-token-123" }
  end
end
