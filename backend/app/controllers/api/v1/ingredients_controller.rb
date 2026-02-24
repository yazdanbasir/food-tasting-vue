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
        ingredients = Ingredient.order(:name)
        render json: ingredients.map { |i| IngredientSerializer.as_json(i, variant: :full) }
      end

      # GET /api/v1/ingredients?q=chicken
      # Returns empty array if query is missing or fewer than 2 characters
      def index
        return render json: [] if params[:q].blank? || params[:q].length < 2

        ingredients = Ingredient.search(params[:q]).order_by_relevance(params[:q]).limit(SEARCH_LIMIT)
        render json: ingredients.map { |i| IngredientSerializer.as_json(i, variant: :full) }
      end

      # GET /api/v1/ingredients/:id
      def show
        ingredient = Ingredient.find(params[:id])
        render json: IngredientSerializer.as_json(ingredient, variant: :full)
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Not found" }, status: :not_found
      end
    end
  end
end
