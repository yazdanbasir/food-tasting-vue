require "test_helper"

class KitchenResourceTest < ActiveSupport::TestCase
  test "validates presence of kind and name" do
    kr = KitchenResource.new(kind: nil, name: nil)
    assert_not kr.valid?
    assert_includes kr.errors[:kind], "can't be blank"
    assert_includes kr.errors[:name], "can't be blank"
  end

  test "validates kind is in KINDS list" do
    kr = KitchenResource.new(kind: "invalid_kind", name: "Test")
    assert_not kr.valid?
    assert kr.errors[:kind].any? { |e| e.include?("is not included") }
  end

  test "accepts all valid KINDS" do
    KitchenResource::KINDS.each do |kind|
      kr = KitchenResource.new(kind: kind, name: "Test #{kind}", position: 99)
      assert kr.valid?, "Expected #{kind} to be a valid kind"
    end
  end

  test "ordered scope sorts by kind, position, then id" do
    ordered = KitchenResource.ordered
    kinds_positions = ordered.pluck(:kind, :position, :id)
    assert_equal kinds_positions, kinds_positions.sort
  end

  test "KINDS constant contains expected values" do
    assert_equal %w[kitchen utensil helper_driver fridge].sort, KitchenResource::KINDS.sort
  end
end
