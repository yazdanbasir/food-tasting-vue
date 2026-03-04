require "test_helper"

class SubmissionTest < ActiveSupport::TestCase
  test "validates presence of dish_name" do
    sub = Submission.new(team_name: "Test", dish_name: nil)
    assert_not sub.valid?
    assert_includes sub.errors[:dish_name], "can't be blank"
  end

  test "validates presence of team_name" do
    sub = Submission.new(team_name: nil, dish_name: "Dish")
    assert_not sub.valid?
    assert_includes sub.errors[:team_name], "can't be blank"
  end

  test "sync_phone_tails populates phone tails on save" do
    sub = submissions(:team_alpha)
    sub.update!(phone_number: "555-123-4567")
    assert_equal "5551234567", sub.phone_tails
  end

  test "sync_phone_tails handles multiple comma-separated numbers" do
    sub = submissions(:team_alpha)
    sub.update!(phone_number: "555-123-4567, 555-987-6543")
    tails = sub.phone_tails.split(",")
    assert_equal 2, tails.length
    assert_includes tails, "5551234567"
    assert_includes tails, "5559876543"
  end

  test "sync_phone_tails clears tails when phone number blank" do
    sub = submissions(:team_alpha)
    sub.update!(phone_number: "555-123-4567")
    assert sub.phone_tails.present?
    sub.update!(phone_number: "")
    assert_nil sub.phone_tails
  end

  test "phone uniqueness validation catches duplicate across groups" do
    sub_a = submissions(:team_alpha)
    sub_a.update!(phone_number: "555-123-4567")

    sub_b = submissions(:team_beta)
    sub_b.phone_number = "555-123-4567"
    assert_not sub_b.valid?
    assert sub_b.errors[:phone_number].any? { |e| e.include?("has already been added") }
  end

  test "phone uniqueness allows different phone numbers" do
    sub_a = submissions(:team_alpha)
    sub_a.update!(phone_number: "555-111-2222")

    sub_b = submissions(:team_beta)
    sub_b.phone_number = "555-333-4444"
    assert sub_b.valid?
  end

  test "phone uniqueness allows same submission to keep its own number" do
    sub = submissions(:team_alpha)
    sub.update!(phone_number: "555-123-4567")
    sub.reload
    sub.dish_name = "Updated Dish"
    assert sub.valid?
  end

  test "members serialization round-trips JSON array" do
    sub = submissions(:team_alpha)
    sub.update!(members: ["Alice", "Bob", "Charlie"])
    sub.reload
    assert_equal ["Alice", "Bob", "Charlie"], sub.members
  end

  test "has_many submission_ingredients with dependent destroy" do
    sub = submissions(:team_alpha)
    assert sub.submission_ingredients.count > 0
    sub_id = sub.id
    sub.destroy!
    assert_equal 0, SubmissionIngredient.where(submission_id: sub_id).count
  end

  test "has_many ingredients through submission_ingredients" do
    sub = submissions(:team_alpha)
    assert_includes sub.ingredients, ingredients(:apple)
  end

  test "normalized_phone_tails ignores short numbers" do
    sub = submissions(:team_alpha)
    sub.phone_number = "123"
    sub.valid?
    assert_nil sub.phone_tails
  end
end
