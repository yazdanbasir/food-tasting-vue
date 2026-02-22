class Ingredient < ApplicationRecord
  validates :product_id, presence: true, uniqueness: true
  validates :name, presence: true
  validates :price_cents, numericality: { greater_than_or_equal_to: 0 }

  # Case-insensitive name search
  scope :search, ->(query) {
    where("name LIKE ?", "%#{sanitize_sql_like(query)}%") if query.present?
  }

  # Convenience: return price as a decimal for display
  def price
    price_cents / 100.0
  end
end
