module Api
  module V1
    class IngredientsController < ApplicationController
      SEARCH_LIMIT = 20

      # GET /api/v1/ingredients?q=chicken
      # Returns empty array if query is missing or fewer than 2 characters
      def index
        return render json: [] if params[:q].blank? || params[:q].length < 2

        ingredients = Ingredient.search(params[:q]).limit(SEARCH_LIMIT).order(:name)
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
