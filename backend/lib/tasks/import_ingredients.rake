require "sqlite3"

namespace :import do
  BATCH_SIZE = 1000

  desc "Import ingredients from the Giant scraper database into Rails (upsert by product_id)"
  task ingredients: :environment do
    scraper_db_path = Rails.root.join("storage", "giant-inventory.db")

    unless File.exist?(scraper_db_path)
      abort "Scraper DB not found at #{scraper_db_path}"
    end

    source = SQLite3::Database.new(scraper_db_path.to_s)
    source.results_as_hash = true

    scraped_at = Time.current
    inserted   = 0
    updated    = 0
    offset     = 0

    loop do
      rows = source.execute('SELECT * FROM "product-info" LIMIT ? OFFSET ?', BATCH_SIZE, offset)
      break if rows.empty?

      rows.each do |row|
        price_cents = ((row["regular_price"].to_f * 100).round)

        attrs = {
          name:         row["name"],
          size:         row["size"],
          aisle:        row["aisle"],
          image_url:    row["image_url"],
          category:     row["root_cat_name"],
          price_cents:  price_cents,
          is_alcohol:   row["is_alcohol"] == 1,
          gluten:       row["gluten"] == 1,
          dairy:        row["dairy"] == 1,
          egg:          row["egg"] == 1,
          peanut:       row["peanut"] == 1,
          kosher:       row["kosher"] == 1,
          vegan:        row["vegan"] == 1,
          vegetarian:   row["vegetarian"] == 1,
          lactose_free: row["lactose_free"] == 1,
          wheat_free:   row["wheat_free"] == 1,
          scraped_at:   scraped_at
        }

        result = Ingredient.find_or_initialize_by(product_id: row["prod_id"].to_s)

        if result.new_record?
          inserted += 1
        else
          updated += 1
        end

        result.assign_attributes(attrs)
        result.save!
      end

      offset += BATCH_SIZE
    end

    source.close
    puts "Done. #{inserted} inserted, #{updated} updated. Total: #{Ingredient.count}"
  end
end
