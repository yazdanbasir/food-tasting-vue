# Single source of truth for ingredient API JSON.
# Variants: :full (all fields + price + dietary), :summary (no category, no price decimal), :grocery_list (subset for list items).
# Pass an Ingredient or a hash-like (e.g. aggregation row with ingredient_id, product_id, name, ...).
class IngredientSerializer
  DIETARY_KEYS = %i[is_alcohol gluten dairy egg peanut kosher vegan vegetarian lactose_free wheat_free].freeze

  def self.as_json(ingredient_or_hash, variant: :full)
    new(ingredient_or_hash, variant).as_json
  end

  def initialize(ingredient_or_hash, variant = :full)
    @source = ingredient_or_hash
    @variant = variant.to_sym
  end

  def as_json
    base.merge(dietary_hash).merge(variant_extra).compact
  end

  private

  def get(attr)
    id_key = (attr == :id ? :ingredient_id : attr)
    @source.respond_to?(:[]) ? @source[id_key] || @source[attr.to_s] : @source.public_send(attr)
  end

  def base
    {
      id: get(:id),
      product_id: get(:product_id),
      name: get(:name),
      size: get(:size),
      aisle: get(:aisle),
      image_url: get(:image_url),
      price_cents: get(:price_cents)
    }
  end

  def dietary_hash
    return {} if @source.respond_to?(:key?) && !@source.key?(:is_alcohol) && !@source.key?("is_alcohol")

    {
      dietary: DIETARY_KEYS.index_with { |k| @source.respond_to?(:[]) ? (get(k) || false) : @source.public_send(k) }
    }
  end

  def variant_extra
    case @variant
    when :full
      price = @source.respond_to?(:price) ? @source.price : (get(:price_cents).to_f / 100)
      {
        category: get(:category),
        price: price
      }
    when :summary, :grocery_list
      {}
    else
      {}
    end
  end
end
