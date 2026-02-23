class Api::V1::GroceryListController < ApplicationController
  include OrganizerAuthenticatable
  skip_before_action :require_organizer_auth, only: [:show, :update]

  # GET /api/v1/grocery_list
  def show
    # Aggregate all submission_ingredients, group by ingredient
    aggregated = SubmissionIngredient
      .joins(:ingredient, :submission)
      .select(
        "ingredients.id as ingredient_id",
        "ingredients.product_id",
        "ingredients.name",
        "ingredients.size",
        "ingredients.aisle",
        "ingredients.price_cents",
        "ingredients.image_url",
        "SUM(submission_ingredients.quantity) as total_quantity",
        "GROUP_CONCAT(submissions.team_name, '||') as team_names"
      )
      .group("ingredients.id")

    # Load checkin state
    checkins = GroceryCheckin.where(ingredient_id: aggregated.map(&:ingredient_id))
      .index_by(&:ingredient_id)

    # Build items
    items = aggregated.map do |row|
      checkin = checkins[row.ingredient_id]
      aggregated_qty = row.total_quantity.to_i
      {
        ingredient: {
          id: row.ingredient_id,
          product_id: row.product_id,
          name: row.name,
          size: row.size,
          aisle: row.aisle,
          price_cents: row.price_cents,
          image_url: row.image_url
        },
        total_quantity: checkin&.quantity_override || aggregated_qty,
        aggregated_quantity: aggregated_qty,
        teams: row.team_names.split("||").uniq,
        checked: checkin&.checked || false,
        checked_by: checkin&.checked_by,
        checked_at: checkin&.checked_at
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

    ActionCable.server.broadcast("grocery_list", payload)
    render json: payload
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Ingredient not found" }, status: :not_found
  end
end
