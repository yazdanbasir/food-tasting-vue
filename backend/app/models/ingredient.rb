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

  # Order by relevance: names starting with the first search term first, then by
  # where the term appears (earlier = better), then alphabetically. So "milk"
  # shows "Milk", "Milk 2%", "Lactose free milk" before less relevant matches.
  scope :order_by_relevance, ->(query) {
    first_term = query.to_s.split.first
    return order(:name) if first_term.blank?

    safe = sanitize_sql_like(first_term)
    pattern = "#{safe}%"
    quoted_pattern = connection.quote(pattern)
    quoted_term = connection.quote(safe)
    order(
      Arel.sql("CASE WHEN LOWER(name) LIKE LOWER(#{quoted_pattern}) THEN 0 ELSE 1 END")
    ).order(
      Arel.sql("INSTR(LOWER(name), LOWER(#{quoted_term}))")
    ).order(:name)
  }

  # Convenience: return price as a decimal for display
  def price
    price_cents / 100.0
  end
end
