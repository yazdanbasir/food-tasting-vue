Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  # Action Cable WebSocket endpoint
  mount ActionCable.server => "/cable"

  namespace :api do
    namespace :v1 do
      resources :ingredients, only: [ :index, :show ]
      resources :submissions, only: [ :create, :show, :index ], param: :access_code
      patch "submissions/by_id/:id", to: "submissions#update"
      delete "submissions/by_id/:id", to: "submissions#destroy"
      resource :organizer_session, only: [ :create, :destroy ]
      resource :grocery_list, controller: "grocery_list", only: [ :show ] do
        post "items", action: :create_item
        patch ":ingredient_id", to: "grocery_list#update", as: :check_item
      end
      post "submissions/by_id/:submission_id/ingredients", to: "submissions#add_ingredient"
      patch "submissions/by_id/:submission_id/ingredients/:ingredient_id", to: "submissions#update_ingredient_quantity"
    end
  end
end
