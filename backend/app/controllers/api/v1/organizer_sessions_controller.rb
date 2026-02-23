class Api::V1::OrganizerSessionsController < ApplicationController
  # POST /api/v1/organizer_session
  def create
    organizer = Organizer.find_by(username: params[:username])

    if organizer&.authenticate(params[:password])
      token = organizer.regenerate_token
      render json: { token: token, username: organizer.username }
    else
      render json: { error: "Invalid credentials" }, status: :unauthorized
    end
  end

  # DELETE /api/v1/organizer_session
  def destroy
    token = request.headers["Authorization"]&.sub(/\ABearer /, "")
    organizer = Organizer.find_by(token: token)
    organizer&.clear_token
    head :no_content
  end
end
