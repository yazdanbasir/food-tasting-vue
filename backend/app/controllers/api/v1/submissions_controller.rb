class Api::V1::SubmissionsController < ApplicationController
  include OrganizerAuthenticatable
  include Notifiable
  skip_before_action :require_organizer_auth, only: [:create, :index, :lookup, :update]

  # POST /api/v1/submissions
  def create
    raw_country = params[:country_code] || params["country_code"]
    raw_members = params[:members] || params["members"]
    attrs = {
      dish_name: params[:dish_name],
      team_name: params[:team_name],
      notes: params[:notes],
      country_code: raw_country.presence,
      members: raw_members.is_a?(Array) ? raw_members : nil,
      phone_number: params[:phone_number].presence,
      has_cooking_place: params[:has_cooking_place].presence,
      cooking_location: params[:cooking_location].presence,
      found_all_ingredients: params[:found_all_ingredients].presence,
      needs_utensils: params[:needs_utensils].presence
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

    n = @submission.submission_ingredients.count
    members_str = (@submission.members || []).any? ? (@submission.members || []).join(', ') : 'Unknown'
    create_and_broadcast_notification(
      event_type: "new_submission",
      title: "SUBMISSION \u2014 #{@submission.dish_name}",
      message: "by #{members_str} \u00b7 #{n} ingredient#{n == 1 ? '' : 's'}"
    )

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
    create_and_broadcast_notification(
      event_type: "ingredient_added",
      title: "EDIT \u2014 #{submission.dish_name}",
      message: "1 item added \u00b7 #{ingredient.name}"
    )
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
    else
      si.update!(quantity: quantity)
    end
    if quantity < 1
      create_and_broadcast_notification(
        event_type: "ingredient_removed",
        title: "EDIT \u2014 #{submission.dish_name}",
        message: "1 item removed \u00b7 #{ingredient.name}"
      )
    else
      create_and_broadcast_notification(
        event_type: "ingredient_updated",
        title: "EDIT \u2014 #{submission.dish_name}",
        message: "Qty updated \u00b7 #{ingredient.name}"
      )
    end
    render json: submission_json(submission.reload), status: :ok
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
      members: raw_members.is_a?(Array) ? raw_members : submission.members,
      phone_number: params[:phone_number].presence,
      has_cooking_place: params[:has_cooking_place].presence,
      cooking_location: params[:cooking_location].presence,
      found_all_ingredients: params[:found_all_ingredients].presence,
      needs_utensils: params[:needs_utensils].presence
    )

    desired = (params[:ingredients] || []).map { |item| [item[:ingredient_id].to_i, (item[:quantity] || 1).to_i] }.to_h

    # Soft organizer detection — update skips require_organizer_auth but token may still be present
    token = request.headers["Authorization"]&.sub(/\ABearer /, "")
    is_organizer = token.present? && Organizer.exists?(token: token)

    # Compute ingredient diff before transaction
    current_ids = submission.submission_ingredients.pluck(:ingredient_id).to_set
    desired_ids = desired.keys.to_set
    added_count   = (desired_ids - current_ids).size
    removed_count = (current_ids - desired_ids).size

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

    parts = []
    parts << "#{added_count} item#{added_count == 1 ? '' : 's'} added"     if added_count > 0
    parts << "#{removed_count} item#{removed_count == 1 ? '' : 's'} removed" if removed_count > 0
    change_str   = parts.any? ? parts.join(', ') : "Details updated"
    editor_label = is_organizer ? "Organizer" : (submission.members || []).first.presence || "User"
    create_and_broadcast_notification(
      event_type: is_organizer ? "submission_updated_organizer" : "submission_updated_user",
      title: "EDIT \u2014 #{submission.dish_name}",
      message: "by #{editor_label} \u00b7 #{change_str}"
    )

    render json: submission_json(submission.reload), status: :ok
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: :unprocessable_entity
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Submission or ingredient not found" }, status: :not_found
  end

  # DELETE /api/v1/submissions/by_id/:id (organizer only)
  def destroy
    submission = Submission.find(params[:id])
    dish = submission.dish_name
    members_str = (submission.members || []).any? ? (submission.members || []).join(', ') : 'Unknown'
    submission.destroy!
    create_and_broadcast_notification(
      event_type: "submission_deleted",
      title: "DELETION \u2014 #{dish}",
      message: "by #{members_str}"
    )
    head :no_content
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Submission not found" }, status: :not_found
  end

  # GET /api/v1/submissions (organizer only)
  def index
    @submissions = Submission.includes(submission_ingredients: :ingredient).order(created_at: :desc)
    render json: @submissions.map { |s| submission_json(s) }
  end

  # GET /api/v1/submissions/lookup?phone=<phone> (public)
  # Finds a submission by phone number. Matches on the last 10 digits of both sides so
  # country-code prefixes (e.g. +1, 1) are transparent to the comparison.
  def lookup
    raw = params[:phone].to_s
    digits = raw.gsub(/\D/, '')
    Rails.logger.info "[lookup] raw=#{raw.inspect} digits=#{digits.inspect}"
    return render json: { error: "Phone required" }, status: :unprocessable_entity if digits.blank?

    input_tail = digits.last(10)
    Rails.logger.info "[lookup] input_tail=#{input_tail.inspect} (length #{input_tail.length})"
    return render json: { error: "Phone required" }, status: :unprocessable_entity if input_tail.length < 7

    submission = Submission.includes(submission_ingredients: :ingredient).all.find do |s|
      stored = s.phone_number.to_s.gsub(/\D/, '')
      stored_tail = stored.last(10)
      match = stored.length >= 7 && stored_tail == input_tail
      Rails.logger.info "[lookup] submission id=#{s.id} phone_number=#{s.phone_number.inspect} stored_digits=#{stored.inspect} stored_tail=#{stored_tail.inspect} match=#{match}"
      match
    end

    return render json: { error: "No submission found for that phone number" }, status: :not_found unless submission

    Rails.logger.info "[lookup] FOUND submission id=#{submission.id}"
    render json: { submission: submission_json(submission) }
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
      phone_number: submission.phone_number,
      has_cooking_place: submission.has_cooking_place,
      cooking_location: submission.cooking_location,
      found_all_ingredients: submission.found_all_ingredients,
      needs_utensils: submission.needs_utensils,
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
