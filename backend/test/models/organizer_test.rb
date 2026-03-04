require "test_helper"

class OrganizerTest < ActiveSupport::TestCase
  test "validates presence of username" do
    org = Organizer.new(username: nil, password: "password123")
    assert_not org.valid?
    assert_includes org.errors[:username], "can't be blank"
  end

  test "validates uniqueness of username" do
    duplicate = Organizer.new(username: organizers(:admin).username, password: "password123")
    assert_not duplicate.valid?
    assert_includes duplicate.errors[:username], "has already been taken"
  end

  test "has_secure_password authenticates with correct password" do
    org = organizers(:admin)
    assert org.authenticate("testpass123")
  end

  test "has_secure_password rejects wrong password" do
    org = organizers(:admin)
    assert_not org.authenticate("wrongpassword")
  end

  test "regenerate_token creates token when blank" do
    org = organizers(:admin)
    org.update_column(:token, nil)
    token = org.regenerate_token
    assert token.present?
    assert_equal 64, token.length # SecureRandom.hex(32) = 64 chars
  end

  test "regenerate_token preserves existing token" do
    org = organizers(:admin)
    org.update_column(:token, "existing-token")
    token = org.regenerate_token
    assert_equal "existing-token", token
  end

  test "clear_token sets token to nil" do
    org = organizers(:admin)
    org.update_column(:token, "some-token")
    org.clear_token
    assert_nil org.reload.token
  end
end
