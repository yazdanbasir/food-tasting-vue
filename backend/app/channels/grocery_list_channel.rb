class GroceryListChannel < ApplicationCable::Channel
  def subscribed
    stream_from "grocery_list"
  end

  def unsubscribed
  end
end
