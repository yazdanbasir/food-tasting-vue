class Api::V1::GroceryListController < ApplicationController
  include OrganizerAuthenticatable
  include Notifiable
  skip_before_action :require_organizer_auth, only: [:show, :update, :create_item]

  # GET /api/v1/grocery_list
  def show
    # Single query: aggregate submission_ingredients by ingredient and left-join checkin state
    aggregated = SubmissionIngredient
      .joins(:ingredient, :submission)
      .left_joins(ingredient: :grocery_checkin)
      .select(
        "ingredients.id as ingredient_id",
        "ingredients.product_id",
        "ingredients.name",
        "ingredients.size",
        "ingredients.aisle",
        "ingredients.price_cents",
        "ingredients.image_url",
        "ingredients.is_alcohol",
        "ingredients.gluten",
        "ingredients.dairy",
        "ingredients.egg",
        "ingredients.peanut",
        "ingredients.kosher",
        "ingredients.vegan",
        "ingredients.vegetarian",
        "ingredients.lactose_free",
        "ingredients.wheat_free",
        "SUM(submission_ingredients.quantity) as total_quantity",
        "GROUP_CONCAT(submissions.team_name, '||') as team_names",
        "grocery_checkins.checked as checkin_checked",
        "grocery_checkins.checked_by as checkin_checked_by",
        "grocery_checkins.checked_at as checkin_checked_at",
        "grocery_checkins.quantity_override as checkin_quantity_override"
      )
      .group("ingredients.id")

    items = aggregated.map do |row|
      aggregated_qty = row.total_quantity.to_i
      ingredient_row = {
        "id" => row.ingredient_id,
        "ingredient_id" => row.ingredient_id,
        "product_id" => row.product_id,
        "name" => row.name,
        "size" => row.size,
        "aisle" => row.aisle,
        "price_cents" => row.price_cents,
        "image_url" => row.image_url,
        "is_alcohol" => row.try(:is_alcohol) || false,
        "gluten" => row.try(:gluten) || false,
        "dairy" => row.try(:dairy) || false,
        "egg" => row.try(:egg) || false,
        "peanut" => row.try(:peanut) || false,
        "kosher" => row.try(:kosher) || false,
        "vegan" => row.try(:vegan) || false,
        "vegetarian" => row.try(:vegetarian) || false,
        "lactose_free" => row.try(:lactose_free) || false,
        "wheat_free" => row.try(:wheat_free) || false
      }
      checkin_qty = row.try(:checkin_quantity_override)
      total_qty = checkin_qty.present? ? checkin_qty.to_i : aggregated_qty
      checked_val = row.try(:checkin_checked)
      {
        ingredient: IngredientSerializer.as_json(ingredient_row, variant: :grocery_list),
        total_quantity: total_qty,
        aggregated_quantity: aggregated_qty,
        teams: row.team_names.to_s.split("||").uniq,
        checked: checked_val == true || checked_val == 1,
        checked_by: row.try(:checkin_checked_by),
        checked_at: row.try(:checkin_checked_at)
      }
    end

    # Group by aisle
    grouped = items.group_by { |item| item[:ingredient][:aisle] || "Other" }

    # Sort: numeric aisles first (e.g. "A1", "B2"), then named (e.g. "Produce", "Dairy")
    sorted_aisles = grouped.sort_by do |aisle, _|
      numeric = aisle.match?(/\A[A-Z]\d+\z/i)
      [numeric ? 0 : 1, aisle]
    end.to_h

    total_cents = items.sum { |item| item[:ingredient][:price_cents] * item[:total_quantity] }

    render json: { aisles: sorted_aisles, total_cents: total_cents }
  end

  # POST /api/v1/grocery_list/items (organizer only — add product to master list)
  def create_item
    quantity = (params[:quantity].presence || 1).to_i
    quantity = 1 if quantity < 1
    ingredient = Ingredient.find(params[:ingredient_id])
    submission = find_or_create_organizer_submission
    si = submission.submission_ingredients.find_or_initialize_by(ingredient: ingredient)
    si.quantity = si.quantity.to_i + quantity
    si.save!
    create_and_broadcast_notification(
      event_type: "grocery_item_added",
      title: "GROCERY \u2014 ITEM ADDED",
      message: ingredient.name
    )
    render json: { ingredient_id: ingredient.id, quantity: si.quantity }, status: :created
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Ingredient not found" }, status: :not_found
  end

  # PATCH /api/v1/grocery_list/:ingredient_id
  def update
    ingredient = Ingredient.find(params[:ingredient_id])
    checkin = GroceryCheckin.find_or_initialize_by(ingredient: ingredient)

    attrs = {}
    if params.key?(:checked)
      checked = params[:checked]
      attrs[:checked] = checked
      attrs[:checked_by] = checked ? (@current_organizer&.username) : nil
      attrs[:checked_at] = checked ? Time.current : nil
    end
    if params.key?(:quantity)
      attrs[:quantity_override] = params[:quantity].to_i
    end

    checkin.assign_attributes(attrs)
    checkin.save!

    payload = {
      ingredient_id: ingredient.id,
      checked: checkin.checked,
      checked_by: checkin.checked_by,
      checked_at: checkin.checked_at,
      quantity_override: checkin.quantity_override
    }

    if params.key?(:checked)
      if params[:checked]
        create_and_broadcast_notification(event_type: "grocery_item_checked",   title: "GROCERY \u2014 CHECKED",     message: ingredient.name)
      else
        create_and_broadcast_notification(event_type: "grocery_item_unchecked", title: "GROCERY \u2014 UNCHECKED",   message: ingredient.name)
      end
    elsif params.key?(:quantity)
      create_and_broadcast_notification(event_type: "grocery_qty_changed",      title: "GROCERY \u2014 QTY UPDATED", message: ingredient.name)
    end

    ActionCable.server.broadcast("grocery_list", payload)
    render json: payload
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Ingredient not found" }, status: :not_found
  end

  def find_or_create_organizer_submission
    Submission.find_or_create_by!(team_name: "Organizer", dish_name: "Extra items")
  end
end
