class Ingredient < ApplicationRecord
  validates :product_id, presence: true, uniqueness: true
  validates :name, presence: true
  validates :price_cents, numericality: { greater_than_or_equal_to: 0 }

  # Each whitespace-separated word must appear somewhere in the name (AND logic).
  # "philadelphia cream cheese" matches "Philadelphia Original Cream Cheese".
  scope :search, ->(query) {
    if query.present?
      query.split.reduce(all) { |rel, term|
        rel.where("name LIKE ?", "%#{sanitize_sql_like(term)}%")
      }
    end
  }

  # Convenience: return price as a decimal for display
  def price
    price_cents / 100.0
  end
end
