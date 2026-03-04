class Api::V1::FormLockController < ApplicationController
  include OrganizerAuthenticatable
  skip_before_action :require_organizer_auth, only: [:show]

  def show
    render json: { submissions_locked: AppSetting.current.submissions_locked }
  end

  def update
    setting = AppSetting.current
    locked = ActiveModel::Type::Boolean.new.cast(params[:submissions_locked])
    setting.update!(submissions_locked: locked)
    render json: { submissions_locked: setting.submissions_locked }
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: :unprocessable_entity
  end
end
