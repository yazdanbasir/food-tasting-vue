module Api
  module V1
    class IngredientsController < ApplicationController
      # Broad queries (e.g. "milk") can match many products; return enough to scroll and find the one you want
      SEARCH_LIMIT = 500

      # GET /api/v1/ingredients/all
      # Returns every ingredient ordered by name; browser-cached for 1 hour.
      # Used by the frontend to preload the full dataset for instant client-side search.
      def all
        expires_in 1.hour
        rows = ActiveRecord::Base.connection.select_all(
          "SELECT id, product_id, name, size, aisle, category, image_url, price_cents,
           is_alcohol, gluten, dairy, egg, peanut, kosher, vegan, vegetarian, lactose_free, wheat_free
           FROM ingredients ORDER BY name"
        ).map do |row|
          {
            id:          row["id"],
            product_id:  row["product_id"],
            name:        row["name"],
            size:        row["size"],
            aisle:       row["aisle"],
            category:    row["category"],
            image_url:   row["image_url"],
            price_cents: row["price_cents"],
            price:       row["price_cents"].to_f / 100,
            dietary: {
              is_alcohol:   row["is_alcohol"] == 1,
              gluten:       row["gluten"] == 1,
              dairy:        row["dairy"] == 1,
              egg:          row["egg"] == 1,
              peanut:       row["peanut"] == 1,
              kosher:       row["kosher"] == 1,
              vegan:        row["vegan"] == 1,
              vegetarian:   row["vegetarian"] == 1,
              lactose_free: row["lactose_free"] == 1,
              wheat_free:   row["wheat_free"] == 1
            }
          }
        end
        render json: rows
      end

      # GET /api/v1/ingredients?q=chicken
      # Returns empty array if query is missing or fewer than 2 characters
      def index
        return render json: [] if params[:q].blank? || params[:q].length < 2

        ingredients = Ingredient.search(params[:q]).order_by_relevance(params[:q]).limit(SEARCH_LIMIT)
        render json: ingredients.map { |i| serialize(i) }
      end

      # GET /api/v1/ingredients/:id
      def show
        ingredient = Ingredient.find(params[:id])
        render json: serialize(ingredient)
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Not found" }, status: :not_found
      end

      private

      def serialize(ingredient)
        {
          id:           ingredient.id,
          product_id:   ingredient.product_id,
          name:         ingredient.name,
          size:         ingredient.size,
          aisle:        ingredient.aisle,
          category:     ingredient.category,
          image_url:    ingredient.image_url,
          price_cents:  ingredient.price_cents,
          price:        ingredient.price,
          dietary: {
            is_alcohol:   ingredient.is_alcohol,
            gluten:       ingredient.gluten,
            dairy:        ingredient.dairy,
            egg:          ingredient.egg,
            peanut:       ingredient.peanut,
            kosher:       ingredient.kosher,
            vegan:        ingredient.vegan,
            vegetarian:   ingredient.vegetarian,
            lactose_free: ingredient.lactose_free,
            wheat_free:   ingredient.wheat_free
          }
        }
      end
    end
  end
end
