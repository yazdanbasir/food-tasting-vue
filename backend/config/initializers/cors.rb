Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    # Vue dev server + production preview server
    # Add your production frontend URL here when deploying
    origins "http://localhost:5173", "http://localhost:4173"

    resource "*",
      headers: :any,
      methods: [ :get, :post, :put, :patch, :delete, :options, :head ]
  end
end
