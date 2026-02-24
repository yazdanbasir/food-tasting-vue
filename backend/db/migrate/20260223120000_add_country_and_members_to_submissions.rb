class AddCountryAndMembersToSubmissions < ActiveRecord::Migration[8.1]
  def change
    add_column :submissions, :country_code, :string
    add_column :submissions, :members, :text
  end
end
