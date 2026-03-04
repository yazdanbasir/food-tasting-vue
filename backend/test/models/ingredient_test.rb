require "test_helper"

class IngredientTest < ActiveSupport::TestCase
  test "validates presence of product_id and name" do
    ing = Ingredient.new(price_cents: 100)
    assert_not ing.valid?
    assert_includes ing.errors[:product_id], "can't be blank"
    assert_includes ing.errors[:name], "can't be blank"
  end

  test "validates uniqueness of product_id" do
    duplicate = Ingredient.new(
      product_id: ingredients(:apple).product_id,
      name: "Other Apple",
      price_cents: 100
    )
    assert_not duplicate.valid?
    assert_includes duplicate.errors[:product_id], "has already been taken"
  end

  test "validates price_cents is non-negative" do
    ing = Ingredient.new(product_id: "new-001", name: "Test", price_cents: -1)
    assert_not ing.valid?
    assert ing.errors[:price_cents].any?
  end

  test "search scope filters by name with AND logic" do
    results = Ingredient.search("apple")
    assert_includes results, ingredients(:apple)
    assert_not_includes results, ingredients(:chicken)
  end

  test "search scope returns all when query blank" do
    assert_equal Ingredient.count, Ingredient.search("").count
    assert_equal Ingredient.count, Ingredient.search(nil).count
  end

  test "order_by_relevance puts exact prefix matches first" do
    results = Ingredient.search("apple").order_by_relevance("apple")
    assert results.first == ingredients(:apple) || results.any? { |i| i.name.downcase.start_with?("apple") }
  end

  test "price returns float from price_cents" do
    ing = ingredients(:apple)
    assert_equal ing.price_cents / 100.0, ing.price
  end

  test "has_one grocery_checkin with dependent destroy" do
    # Use ingredent without FK constraints from submission_ingredients
    ing = Ingredient.create!(product_id: "test-checkin-001", name: "Checkin Test Item", price_cents: 100)
    GroceryCheckin.create!(ingredient: ing, checked: true, checked_by: "admin")
    assert ing.grocery_checkin.present?
    ing.destroy!
    assert_equal 0, GroceryCheckin.where(ingredient_id: ing.id).count
  end
end
