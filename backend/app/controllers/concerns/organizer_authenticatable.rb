module OrganizerAuthenticatable
  extend ActiveSupport::Concern

  included do
    before_action :require_organizer_auth
  end

  private

  def require_organizer_auth
    token = request.headers["Authorization"]&.sub(/\ABearer /, "")
    @current_organizer = Organizer.find_by(token: token) if token.present?
    render json: { error: "Unauthorized" }, status: :unauthorized unless @current_organizer
  end
end
