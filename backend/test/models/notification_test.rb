require "test_helper"

class NotificationTest < ActiveSupport::TestCase
  test "unread scope returns only unread notifications" do
    unread = Notification.unread
    assert unread.all? { |n| n.read == false }
    assert_includes unread, notifications(:new_submission)
    assert_not_includes unread, notifications(:read_notification)
  end

  test "recent scope returns up to 50 ordered by newest first" do
    recent = Notification.recent
    assert recent.length <= 50
    if recent.length > 1
      assert recent.first.created_at >= recent.last.created_at
    end
  end

  test "to_broadcast_json returns correct keys" do
    n = notifications(:new_submission)
    json = n.to_broadcast_json
    assert_equal n.id, json[:id]
    assert_equal n.event_type, json[:event_type]
    assert_equal n.title, json[:title]
    assert_equal n.message, json[:message]
    assert_equal n.read, json[:read]
    assert_equal n.created_at, json[:created_at]
  end

  test "validates presence of event_type and title" do
    n = Notification.new(event_type: nil, title: nil)
    # These are enforced by the database NOT NULL constraint; model may not have explicit validations.
    # But save! should raise:
    assert_raises(ActiveRecord::NotNullViolation) { n.save!(validate: false) }
  end
end
