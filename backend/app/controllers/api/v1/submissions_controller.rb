class Api::V1::SubmissionsController < ApplicationController
  include OrganizerAuthenticatable
  skip_before_action :require_organizer_auth, only: [:create, :index]

  # POST /api/v1/submissions
  def create
    raw_country = params[:country_code] || params["country_code"]
    raw_members = params[:members] || params["members"]
    attrs = {
      dish_name: params[:dish_name],
      team_name: params[:team_name],
      notes: params[:notes],
      country_code: raw_country.presence,
      members: raw_members.is_a?(Array) ? raw_members : nil
    }
    @submission = Submission.new(attrs)

    Submission.transaction do
      @submission.save!

      (params[:ingredients] || []).each do |item|
        ingredient = Ingredient.find(item[:ingredient_id])
        @submission.submission_ingredients.create!(
          ingredient: ingredient,
          quantity: item[:quantity].to_i
        )
      end
    end

    ActionCable.server.broadcast("notifications", {
      type: "new_submission",
      team_name: @submission.team_name,
      dish_name: @submission.dish_name,
      timestamp: @submission.created_at
    })

    render json: { submission: submission_json(@submission) }, status: :created
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: :unprocessable_entity
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Ingredient not found" }, status: :not_found
  end

  # POST /api/v1/submissions/by_id/:submission_id/ingredients (organizer only)
  def add_ingredient
    submission = Submission.find(params[:submission_id])
    quantity = (params[:quantity].presence || 1).to_i
    quantity = 1 if quantity < 1
    ingredient = Ingredient.find(params[:ingredient_id])
    si = submission.submission_ingredients.find_or_initialize_by(ingredient: ingredient)
    si.quantity = si.quantity.to_i + quantity
    si.save!
    render json: submission_json(submission.reload), status: :ok
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Submission or ingredient not found" }, status: :not_found
  end

  # PATCH /api/v1/submissions/by_id/:submission_id/ingredients/:ingredient_id (organizer only)
  def update_ingredient_quantity
    submission = Submission.find(params[:submission_id])
    ingredient = Ingredient.find(params[:ingredient_id])
    si = submission.submission_ingredients.find_by!(ingredient: ingredient)
    quantity = (params[:quantity].presence || 0).to_i
    if quantity < 1
      si.destroy!
      render json: submission_json(submission.reload), status: :ok
    else
      si.update!(quantity: quantity)
      render json: submission_json(submission.reload), status: :ok
    end
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Submission or ingredient not found" }, status: :not_found
  end

  # PATCH /api/v1/submissions/by_id/:id (organizer only)
  def update
    submission = Submission.find(params[:id])
    raw_country = params[:country_code] || params["country_code"]
    raw_members = params[:members] || params["members"]

    submission.assign_attributes(
      dish_name: params[:dish_name],
      team_name: params[:team_name],
      notes: params[:notes],
      country_code: raw_country.presence,
      members: raw_members.is_a?(Array) ? raw_members : submission.members
    )

    desired = (params[:ingredients] || []).map { |item| [item[:ingredient_id].to_i, (item[:quantity] || 1).to_i] }.to_h

    Submission.transaction do
      submission.save!
      current_by_ingredient = submission.submission_ingredients.index_by(&:ingredient_id)

      desired.each do |ingredient_id, qty|
        si = current_by_ingredient[ingredient_id]
        if si
          si.update!(quantity: qty) if si.quantity != qty
        else
          ingredient = Ingredient.find(ingredient_id)
          submission.submission_ingredients.create!(ingredient: ingredient, quantity: qty)
        end
      end

      current_by_ingredient.each_key do |ingredient_id|
        current_by_ingredient[ingredient_id].destroy! unless desired.key?(ingredient_id)
      end
    end

    ActionCable.server.broadcast("notifications", {
      type: "submission_updated",
      submission_id: submission.id,
      timestamp: submission.updated_at
    })

    render json: submission_json(submission.reload), status: :ok
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: :unprocessable_entity
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Submission or ingredient not found" }, status: :not_found
  end

  # DELETE /api/v1/submissions/by_id/:id (organizer only)
  def destroy
    submission = Submission.find(params[:id])
    submission.destroy!
    head :no_content
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Submission not found" }, status: :not_found
  end

  # GET /api/v1/submissions (organizer only)
  def index
    @submissions = Submission.includes(submission_ingredients: :ingredient).order(created_at: :desc)
    render json: @submissions.map { |s| submission_json(s) }
  end

  private

  def submission_json(submission)
    {
      id: submission.id,
      team_name: submission.team_name,
      dish_name: submission.dish_name,
      notes: submission.notes,
      country_code: submission.country_code,
      members: submission.members.is_a?(Array) ? submission.members : [],
      submitted_at: submission.created_at,
      ingredients: submission.submission_ingredients.map do |si|
        {
          ingredient: ingredient_json(si.ingredient),
          quantity: si.quantity
        }
      end
    }
  end

  def ingredient_json(ingredient)
    IngredientSerializer.as_json(ingredient, variant: :summary)
  end
end
