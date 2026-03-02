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

ActiveRecord::Schema[8.1].define(version: 2026_03_01_120000) do
  create_table "grocery_checkins", force: :cascade do |t|
    t.boolean "checked", default: false, null: false
    t.datetime "checked_at"
    t.string "checked_by"
    t.datetime "created_at", null: false
    t.integer "ingredient_id", null: false
    t.integer "quantity_override"
    t.datetime "updated_at", null: false
    t.index ["ingredient_id"], name: "index_grocery_checkins_on_ingredient_id", unique: true
  end

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
    t.boolean "pork", default: false
    t.integer "price_cents", default: 0, null: false
    t.string "product_id", null: false
    t.datetime "scraped_at"
    t.boolean "shellfish", default: false
    t.string "size"
    t.datetime "updated_at", null: false
    t.boolean "vegan", default: false, null: false
    t.boolean "vegetarian", default: false, null: false
    t.boolean "wheat_free", default: false, null: false
    t.index ["category"], name: "index_ingredients_on_category"
    t.index ["name"], name: "index_ingredients_on_name"
    t.index ["product_id"], name: "index_ingredients_on_product_id", unique: true
  end

  create_table "kitchen_resources", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.boolean "is_driver"
    t.string "kind", null: false
    t.string "name", null: false
    t.string "phone"
    t.string "point_person"
    t.integer "position"
    t.datetime "updated_at", null: false
    t.index ["kind"], name: "index_kitchen_resources_on_kind"
  end

  create_table "notifications", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "event_type", null: false
    t.string "message"
    t.boolean "read", default: false, null: false
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.index ["created_at"], name: "index_notifications_on_created_at"
    t.index ["read"], name: "index_notifications_on_read"
  end

  create_table "organizers", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "password_digest", null: false
    t.string "token"
    t.datetime "updated_at", null: false
    t.string "username", null: false
    t.index ["token"], name: "index_organizers_on_token", unique: true
    t.index ["username"], name: "index_organizers_on_username", unique: true
  end

  create_table "submission_ingredients", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "ingredient_id", null: false
    t.integer "quantity", default: 1, null: false
    t.integer "submission_id", null: false
    t.datetime "updated_at", null: false
    t.index ["ingredient_id"], name: "index_submission_ingredients_on_ingredient_id"
    t.index ["submission_id"], name: "index_submission_ingredients_on_submission_id"
  end

  create_table "submissions", force: :cascade do |t|
    t.string "cooking_location"
    t.string "country_code"
    t.datetime "created_at", null: false
    t.string "dish_name", null: false
    t.string "equipment_allocated"
    t.string "found_all_ingredients"
    t.string "fridge_location"
    t.string "has_cooking_place"
    t.string "helper_driver_needed"
    t.text "members"
    t.string "needs_fridge_space"
    t.string "needs_utensils"
    t.text "notes"
    t.text "other_ingredients"
    t.string "phone_number"
    t.string "team_name", null: false
    t.datetime "updated_at", null: false
    t.text "utensils_notes"
  end

  add_foreign_key "grocery_checkins", "ingredients"
  add_foreign_key "submission_ingredients", "ingredients"
  add_foreign_key "submission_ingredients", "submissions"
end
