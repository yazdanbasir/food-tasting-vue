class Submission < ApplicationRecord
  has_many :submission_ingredients, dependent: :destroy
  has_many :ingredients, through: :submission_ingredients

  serialize :members, coder: JSON

  before_validation :sync_phone_tails

  validates :team_name, :dish_name, presence: true
  validate :phone_numbers_must_be_unique_across_groups

  private

  def sync_phone_tails
    self.phone_tails = normalized_phone_tails(phone_number).join(",").presence
  end

  def phone_numbers_must_be_unique_across_groups
    return if phone_number.blank?

    current_tails = normalized_phone_tails(phone_number)
    return if current_tails.empty?

    # Query the DB for overlapping tails instead of loading all records
    Submission.where.not(id: id).where.not(phone_tails: [nil, ""]).find_each do |submission|
      existing_tails = submission.phone_tails.to_s.split(",")
      next if existing_tails.empty?
      overlap = (current_tails & existing_tails).first
      if overlap.present?
        errors.add(:phone_number, "#{overlap} has already been added to another group")
        break
      end
    end
  end

  def normalized_phone_tails(raw)
    raw.to_s
      .split(/\s*,\s*/)
      .map { |value| value.gsub(/\D/, '') }
      .map { |digits| digits.last(10) }
      .select { |tail| tail.length >= 7 }
      .uniq
  end
end
