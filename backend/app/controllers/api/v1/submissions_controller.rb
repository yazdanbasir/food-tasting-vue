class Api::V1::SubmissionsController < ApplicationController
  include OrganizerAuthenticatable
  include Notifiable
  skip_before_action :require_organizer_auth, only: [:create, :index, :lookup, :update]

  # POST /api/v1/submissions
  def create
    return if reject_if_locked_for_students!

    attrs = SubmissionBuilder.new(params).attributes
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

    @submission.reload
    render json: { submission: SubmissionSerializer.as_json(@submission) }, status: :created
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: :unprocessable_entity
  rescue ActiveRecord::StatementInvalid => e
    render json: { error: e.message.truncate(200) }, status: :unprocessable_entity
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Ingredient not found" }, status: :not_found
  end

  # PATCH /api/v1/submissions/:id
  def update
    return if reject_if_locked_for_students!

    submission = Submission.find(params[:id])
    attrs = SubmissionBuilder.new(params).attributes

    # Preserve existing members if not provided
    raw_members = params[:members] || params["members"]
    attrs[:members] = submission.members unless raw_members.is_a?(Array)

    desired = (params[:ingredients] || []).map { |item| [item[:ingredient_id].to_i, (item[:quantity] || 1).to_i] }.to_h
    is_organizer = organizer_request?

    # Compute ingredient diff before transaction
    current_ids = submission.submission_ingredients.pluck(:ingredient_id).to_set
    desired_ids = desired.keys.to_set
    added_count   = (desired_ids - current_ids).size
    removed_count = (current_ids - desired_ids).size

    Submission.transaction do
      submission.assign_attributes(attrs)
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

    submission.reload
    render json: SubmissionSerializer.as_json(submission), status: :ok
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: :unprocessable_entity
  rescue ActiveRecord::StatementInvalid => e
    render json: { error: e.message.truncate(200) }, status: :unprocessable_entity
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Submission or ingredient not found" }, status: :not_found
  end

  # PATCH /api/v1/submissions/:id/kitchen_allocation
  def kitchen_allocation
    submission = Submission.find(params[:id])
    attrs = {}
    attrs[:cooking_location]     = params[:cooking_location]     if params.key?(:cooking_location)
    attrs[:equipment_allocated]  = params[:equipment_allocated]  if params.key?(:equipment_allocated)
    attrs[:helper_driver_needed] = params[:helper_driver_needed] if params.key?(:helper_driver_needed)
    attrs[:fridge_location]      = params[:fridge_location]      if params.key?(:fridge_location)
    submission.update!(attrs)
    render json: SubmissionSerializer.as_json(submission.reload), status: :ok
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: :unprocessable_entity
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Submission not found" }, status: :not_found
  end

  # DELETE /api/v1/submissions/:id
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

  # GET /api/v1/submissions
  def index
    @submissions = Submission.includes(submission_ingredients: :ingredient).order(created_at: :desc)
    render json: @submissions.map { |s| SubmissionSerializer.as_json(s) }
  end

  # GET /api/v1/submissions/lookup?phone=<phone>
  def lookup
    raw = params[:phone].to_s
    digits = raw.gsub(/\D/, '')
    return render json: { error: "Phone required" }, status: :unprocessable_entity if digits.blank?

    input_tail = digits.last(10)

    # Use the indexed phone_tails column for an efficient DB-level match
    submission = if input_tail.length >= 7
                   Submission
                     .includes(submission_ingredients: :ingredient)
                     .where("phone_tails LIKE ?", "%#{Submission.sanitize_sql_like(input_tail)}%")
                     .order(updated_at: :desc, created_at: :desc)
                     .first
                 else
                   # Short input: fall back to exact digit match
                   Submission
                     .includes(submission_ingredients: :ingredient)
                     .where("phone_tails LIKE ?", "%#{Submission.sanitize_sql_like(digits)}%")
                     .order(updated_at: :desc, created_at: :desc)
                     .first
                 end

    return render json: { error: "No submission found for that phone number" }, status: :not_found unless submission

    render json: { submission: SubmissionSerializer.as_json(submission) }
  end

  private

  def organizer_request?
    token = request.headers["Authorization"]&.sub(/\ABearer /, "")
    token.present? && Organizer.exists?(token: token)
  end

  def reject_if_locked_for_students!
    return false unless AppSetting.current.submissions_locked
    return false if organizer_request?

    render json: { error: "Form is closed", code: "submissions_locked" }, status: :forbidden
    true
  end
end
