class AddPhoneTailsToSubmissions < ActiveRecord::Migration[8.1]
  def change
    add_column :submissions, :phone_tails, :text

    reversible do |dir|
      dir.up do
        # Backfill phone_tails for existing submissions
        Submission.where.not(phone_number: [nil, ""]).find_each do |s|
          tails = s.phone_number.to_s
            .split(/\s*,\s*/)
            .map { |v| v.gsub(/\D/, "") }
            .map { |d| d.last(10) }
            .select { |t| t.length >= 7 }
            .uniq
            .sort
            .join(",")
          s.update_column(:phone_tails, tails.presence)
        end
      end
    end
  end
end
