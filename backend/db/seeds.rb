# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).

# Default organizer account (change password in production!)
Organizer.find_or_create_by!(username: "organizer") do |org|
  org.password = "disney1994"
  org.password_confirmation = "disney1994"
end

puts "Seeded organizer account: username=organizer, password=disney1994"
