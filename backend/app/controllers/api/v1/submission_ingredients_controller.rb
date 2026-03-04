class Api::V1::SubmissionIngredientsController < ApplicationController
  include OrganizerAuthenticatable
  include Notifiable

  # POST /api/v1/submissions/:submission_id/ingredients
  def create
    submission = Submission.find(params[:submission_id])
    quantity = (params[:quantity].presence || 1).to_i
    quantity = 1 if quantity < 1
    ingredient = Ingredient.find(params[:ingredient_id])
    si = submission.submission_ingredients.find_or_initialize_by(ingredient: ingredient)
    si.quantity = si.quantity.to_i + quantity
    si.save!
    create_and_broadcast_notification(
      event_type: "ingredient_added",
      title: "EDIT \u2014 #{submission.dish_name}",
      message: "1 item added \u00b7 #{ingredient.name}"
    )
    render json: SubmissionSerializer.as_json(submission.reload), status: :ok
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Submission or ingredient not found" }, status: :not_found
  end

  # PATCH /api/v1/submissions/:submission_id/ingredients/:id
  def update
    submission = Submission.find(params[:submission_id])
    ingredient = Ingredient.find(params[:id])
    si = submission.submission_ingredients.find_by!(ingredient: ingredient)
    quantity = (params[:quantity].presence || 0).to_i
    if quantity < 1
      si.destroy!
      create_and_broadcast_notification(
        event_type: "ingredient_removed",
        title: "EDIT \u2014 #{submission.dish_name}",
        message: "1 item removed \u00b7 #{ingredient.name}"
      )
    else
      si.update!(quantity: quantity)
      create_and_broadcast_notification(
        event_type: "ingredient_updated",
        title: "EDIT \u2014 #{submission.dish_name}",
        message: "Qty updated \u00b7 #{ingredient.name}"
      )
    end
    render json: SubmissionSerializer.as_json(submission.reload), status: :ok
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Submission or ingredient not found" }, status: :not_found
  end
end
