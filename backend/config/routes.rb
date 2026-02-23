Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  # Action Cable WebSocket endpoint
  mount ActionCable.server => "/cable"

  namespace :api do
    namespace :v1 do
      resources :ingredients, only: [ :index, :show ]
      resources :submissions, only: [ :create, :show, :index ], param: :access_code
      resource :organizer_session, only: [ :create, :destroy ]
      resource :grocery_list, controller: "grocery_list", only: [ :show ] do
        patch ":ingredient_id", to: "grocery_list#update", as: :check_item
      end
    end
  end
end
