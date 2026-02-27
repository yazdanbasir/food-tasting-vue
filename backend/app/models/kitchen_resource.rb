class KitchenResource < ApplicationRecord
  KINDS = %w[kitchen utensil].freeze

  validates :kind, presence: true, inclusion: { in: KINDS }
  validates :name, presence: true

  default_scope { order(:kind, :position, :id) }
end

