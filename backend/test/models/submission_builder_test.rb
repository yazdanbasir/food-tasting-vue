require "test_helper"

class SubmissionBuilderTest < ActiveSupport::TestCase
  test "extracts scalar fields from params" do
    params = ActionController::Parameters.new(
      dish_name: "Pasta", team_name: "Alpha", notes: "Spicy"
    )
    attrs = SubmissionBuilder.new(params).attributes
    assert_equal "Pasta", attrs[:dish_name]
    assert_equal "Alpha", attrs[:team_name]
    assert_equal "Spicy", attrs[:notes]
  end

  test "required fields are nil when empty not omitted" do
    params = ActionController::Parameters.new(
      dish_name: "", team_name: ""
    )
    attrs = SubmissionBuilder.new(params).attributes
    # Required fields still go through .presence — nil so model validation fires
    assert_nil attrs[:dish_name]
    assert_nil attrs[:team_name]
  end

  test "casts boolean fields from string values" do
    params = ActionController::Parameters.new(
      dish_name: "Pasta", team_name: "A",
      has_cooking_place: "true", needs_fridge_space: "false",
      needs_utensils: "1", found_all_ingredients: "0"
    )
    attrs = SubmissionBuilder.new(params).attributes
    assert_equal true, attrs[:has_cooking_place]
    assert_equal false, attrs[:needs_fridge_space]
    assert_equal true, attrs[:needs_utensils]
    assert_equal false, attrs[:found_all_ingredients]
  end

  test "casts boolean fields from actual booleans" do
    params = ActionController::Parameters.new(
      dish_name: "Pasta", team_name: "A",
      has_cooking_place: true, needs_fridge_space: false
    )
    attrs = SubmissionBuilder.new(params).attributes
    assert_equal true, attrs[:has_cooking_place]
    assert_equal false, attrs[:needs_fridge_space]
  end

  test "handles country_code OTHER with country_name_other" do
    params = ActionController::Parameters.new(
      dish_name: "X", team_name: "A",
      country_code: "OTHER", country_name_other: "Narnia"
    )
    attrs = SubmissionBuilder.new(params).attributes
    assert_equal "OTHER", attrs[:country_code]
    assert_equal "Narnia", attrs[:country_name]
  end

  test "clears country_name when country_code is not OTHER" do
    params = ActionController::Parameters.new(
      dish_name: "X", team_name: "A",
      country_code: "US", country_name_other: "Narnia"
    )
    attrs = SubmissionBuilder.new(params).attributes
    assert_equal "US", attrs[:country_code]
    assert_nil attrs[:country_name]
  end

  test "extracts members as array" do
    params = ActionController::Parameters.new(
      dish_name: "X", team_name: "A",
      members: ["Alice", "Bob"]
    )
    attrs = SubmissionBuilder.new(params).attributes
    assert_equal ["Alice", "Bob"], attrs[:members]
  end

  test "members is nil when not an array" do
    params = ActionController::Parameters.new(
      dish_name: "X", team_name: "A",
      members: "not_an_array"
    )
    attrs = SubmissionBuilder.new(params).attributes
    assert_nil attrs[:members]
  end

  test "blank scalar fields become nil" do
    params = ActionController::Parameters.new(
      dish_name: "", team_name: "", notes: "  "
    )
    attrs = SubmissionBuilder.new(params).attributes
    assert_nil attrs[:dish_name]
    assert_nil attrs[:team_name]
    assert_nil attrs[:notes]
  end
end
