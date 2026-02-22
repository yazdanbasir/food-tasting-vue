# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_02_22_143944) do
  create_table "ingredients", force: :cascade do |t|
    t.string "aisle"
    t.string "category"
    t.datetime "created_at", null: false
    t.boolean "dairy", default: false, null: false
    t.boolean "egg", default: false, null: false
    t.boolean "gluten", default: false, null: false
    t.string "image_url"
    t.boolean "is_alcohol", default: false, null: false
    t.boolean "kosher", default: false, null: false
    t.boolean "lactose_free", default: false, null: false
    t.string "name", null: false
    t.boolean "peanut", default: false, null: false
    t.integer "price_cents", default: 0, null: false
    t.string "product_id", null: false
    t.datetime "scraped_at"
    t.string "size"
    t.datetime "updated_at", null: false
    t.boolean "vegan", default: false, null: false
    t.boolean "vegetarian", default: false, null: false
    t.boolean "wheat_free", default: false, null: false
    t.index ["category"], name: "index_ingredients_on_category"
    t.index ["name"], name: "index_ingredients_on_name"
    t.index ["product_id"], name: "index_ingredients_on_product_id", unique: true
  end
end
