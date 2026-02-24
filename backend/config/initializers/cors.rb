Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    allowed = [ /\Ahttp:\/\/localhost(:\d+)?\z/ ]
    allowed << ENV["FRONTEND_URL"] if ENV["FRONTEND_URL"].present?

    origins(*allowed)

    resource "*",
      headers: :any,
      methods: [ :get, :post, :put, :patch, :delete, :options, :head ]
  end
end
