class Api::V1::KitchenResourcesController < ApplicationController
  include OrganizerAuthenticatable
  skip_before_action :require_organizer_auth, only: [:index]

  # GET /api/v1/kitchen_resources
  def index
    resources = KitchenResource.order(:kind, :position, :id)
    render json: resources.map { |r| serialize_resource(r) }
  end

  # POST /api/v1/kitchen_resources
  def create
    resource = KitchenResource.new(resource_params)
    resource.position ||= next_position_for(resource.kind)
    if resource.save
      render json: serialize_resource(resource), status: :created
    else
      render json: { error: resource.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  # PATCH /api/v1/kitchen_resources/:id
  def update
    resource = KitchenResource.find(params[:id])
    if resource.update(resource_params)
      render json: serialize_resource(resource), status: :ok
    else
      render json: { error: resource.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Not found" }, status: :not_found
  end

  # DELETE /api/v1/kitchen_resources/:id
  def destroy
    resource = KitchenResource.find(params[:id])
    resource.destroy!
    head :no_content
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Not found" }, status: :not_found
  end

  private

  def resource_params
    params.permit(:kind, :name, :position)
  end

  def next_position_for(kind)
    KitchenResource.where(kind: kind).maximum(:position).to_i + 1
  end

  def serialize_resource(resource)
    {
      id: resource.id,
      kind: resource.kind,
      name: resource.name,
      position: resource.position
    }
  end
end

