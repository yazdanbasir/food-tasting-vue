require "test_helper"

class GroceryCheckinTest < ActiveSupport::TestCase
  test "belongs to ingredient" do
    checkin = GroceryCheckin.create!(ingredient: ingredients(:apple))
    assert_equal ingredients(:apple), checkin.ingredient
  end

  test "validates quantity_override is non-negative integer when present" do
    checkin = GroceryCheckin.new(ingredient: ingredients(:chicken), quantity_override: -1)
    assert_not checkin.valid?

    checkin.quantity_override = 0
    assert checkin.valid?

    checkin.quantity_override = nil
    assert checkin.valid?
  end
end
