class AddCountryAndMembersToSubmissions < ActiveRecord::Migration[8.1]
  def change
    add_column :submissions, :country_code, :string unless column_exists?(:submissions, :country_code)
    add_column :submissions, :members, :text unless column_exists?(:submissions, :members)
  end
end
