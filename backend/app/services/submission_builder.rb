# Extracts and normalises submission attributes from controller params.
# Used by both create and update actions to avoid duplication.
class SubmissionBuilder
  # Required fields keep their raw value (empty string stays empty, never nil-ified
  # via .presence) so that model validations fire instead of a bare NOT NULL violation.
  REQUIRED_FIELDS = %i[dish_name team_name].freeze

  OPTIONAL_FIELDS = %i[
    notes phone_number cooking_location
    utensils_notes dish_temperature dish_description allergen other_ingredients meat_items
    equipment_allocated helper_driver_needed fridge_location
  ].freeze

  BOOLEAN_FIELDS = %i[
    has_cooking_place needs_fridge_space needs_utensils found_all_ingredients
  ].freeze

  def initialize(params)
    @params = params
  end

  def attributes
    attrs = scalar_attrs
      .merge(boolean_attrs)
      .merge(country_attrs)
      .merge(members_attr)
    attrs
  end

  private

  def scalar_attrs
    h = {}
    REQUIRED_FIELDS.each { |key| h[key] = read(key).to_s.presence }
    OPTIONAL_FIELDS.each { |key| h[key] = read(key).presence }
    h
  end

  def boolean_attrs
    BOOLEAN_FIELDS.each_with_object({}) do |key, h|
      raw = read(key)
      h[key] = cast_boolean(raw)
    end
  end

  def country_attrs
    raw_country = @params[:country_code] || @params["country_code"]
    raw_country_name = @params[:country_name_other] || @params["country_name_other"]
    {
      country_code: raw_country.presence,
      country_name: (raw_country == "OTHER" ? raw_country_name.presence : nil)
    }
  end

  def members_attr
    raw = @params[:members] || @params["members"]
    { members: raw.is_a?(Array) ? raw : nil }
  end

  # Read a scalar param from top-level or nested :submission key.
  def read(key)
    val = @params[key] || @params[key.to_s]
    if val.nil? && @params[:submission].respond_to?(:[])
      nested = @params[:submission]
      val = nested[key] || nested[key.to_s]
    end
    val
  end

  def cast_boolean(raw)
    return raw if raw.is_a?(TrueClass) || raw.is_a?(FalseClass)

    ActiveModel::Type::Boolean.new.cast(raw) || false
  end
end
