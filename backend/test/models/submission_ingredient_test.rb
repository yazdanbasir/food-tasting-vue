require "test_helper"

class SubmissionIngredientTest < ActiveSupport::TestCase
  test "belongs to submission and ingredient" do
    si = submission_ingredients(:alpha_apple)
    assert_equal submissions(:team_alpha), si.submission
    assert_equal ingredients(:apple), si.ingredient
  end

  test "validates quantity is a positive integer" do
    si = submission_ingredients(:alpha_apple)
    si.quantity = 0
    assert_not si.valid?

    si.quantity = -1
    assert_not si.valid?

    si.quantity = 1.5
    assert_not si.valid?

    si.quantity = 3
    assert si.valid?
  end

  test "validates uniqueness of ingredient scoped to submission" do
    duplicate = SubmissionIngredient.new(
      submission: submissions(:team_alpha),
      ingredient: ingredients(:apple),
      quantity: 1
    )
    assert_not duplicate.valid?
    assert_includes duplicate.errors[:ingredient_id], "has already been taken"
  end

  test "allows same ingredient on different submissions" do
    si = SubmissionIngredient.new(
      submission: submissions(:team_beta),
      ingredient: ingredients(:chicken),
      quantity: 2
    )
    assert si.valid?
  end
end
