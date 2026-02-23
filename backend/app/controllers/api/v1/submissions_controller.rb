class Api::V1::SubmissionsController < ApplicationController
  include OrganizerAuthenticatable
  skip_before_action :require_organizer_auth, only: [:create, :show, :index]

  # POST /api/v1/submissions
  def create
    @submission = Submission.new(
      dish_name: params[:dish_name],
      team_name: params[:team_name],
      notes: params[:notes]
    )

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

    render json: {
      access_code: @submission.access_code,
      submission: submission_json(@submission)
    }, status: :created
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: :unprocessable_entity
  end

  # GET /api/v1/submissions/:access_code
  def show
    @submission = Submission.find_by!(access_code: params[:access_code])
    render json: submission_json(@submission)
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
      access_code: submission.access_code,
      team_name: submission.team_name,
      dish_name: submission.dish_name,
      notes: submission.notes,
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
    {
      id: ingredient.id,
      product_id: ingredient.product_id,
      name: ingredient.name,
      size: ingredient.size,
      aisle: ingredient.aisle,
      price_cents: ingredient.price_cents,
      image_url: ingredient.image_url
    }
  end
end
