class KitchenResource < ApplicationRecord
  KINDS = %w[kitchen utensil helper_driver fridge].freeze

  validates :kind, presence: true, inclusion: { in: KINDS }
  validates :name, presence: true

  scope :ordered, -> { order(:kind, :position, :id) }
end

