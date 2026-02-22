# Fundamentals

## Vue

- **Single File Components (SFCs)** (the `.vue` file structure — `<template>`, `<script>`, `<style>` in one file) [JSX files with CSS modules]
- **`<script setup>`** (the modern shorthand for Composition API — you'll use this in almost every component) [function component body]
- **Template syntax & directives** (`v-if`, `v-for`, `v-bind`, `v-on`) [JSX + inline expressions]
- **Reactive data with `ref` and `reactive`** [useState]
- **Computed properties** [useMemo]
- **Watchers** (`watch`, `watchEffect`) [useEffect]
- **Component props & emits** [props & callbacks/onChange]
- **Slots** [children & render props]
- **Lifecycle hooks** (`onMounted`, `onUnmounted`, etc.) [useEffect with deps]
- **Composables** (reusable logic functions) [custom hooks]
- **Component-level state with `defineProps` / `defineEmits`** [TypeScript prop interfaces]
- **Pinia** (state management) [Redux / Zustand / Context]
- **Vue Router** (routing with `<router-view>`, `useRoute`, `useRouter`) [React Router]
- **`<Suspense>` & async components** [Suspense + lazy()]
- **`v-model`** (two-way binding) [controlled inputs with value + onChange]
- **Provide / Inject** [Context API]
- **Transition & animation utilities** [Framer Motion / CSS transitions manually]
- **Template refs** (`ref` on a DOM element to access it directly) [useRef]
- **`<Teleport>`** (render content outside the component tree — great for modals) [React Portal]
- **`<KeepAlive>`** (cache a component's state when toggled — avoids re-mounting) [no direct equivalent]
- **Plugins** (`app.use(...)` — how Vue installs global functionality like Pinia, Router) [React Context providers at root]
- **Custom directives** (creating your own `v-something` for reusable DOM behavior) [no direct equivalent]

## Rails

- **MVC architecture** (Models, Views, Controllers — you'll mostly use M and C for an API)
- **Routes** (`config/routes.rb`, REST conventions) [Express router / Next.js API routes]
- **Controllers** (handle requests, return JSON with `render json:`)
- **ActiveRecord models** (ORM — maps classes to DB tables)
- **Migrations** (version-controlled DB schema changes)
- **Validations** (`validates :name, presence: true`, etc.)
- **Associations** (`has_many`, `belongs_to`, `has_many :through`)
- **Scopes & queries** (ActiveRecord query interface — `.where`, `.includes`, `.order`)
- **Strong parameters** (`params.require(...).permit(...)` — prevents mass assignment)
- **Serializers** (shaping JSON output — via `jbuilder` or `active_model_serializers`)
- **Concerns** (shared model/controller logic — like mixins)
- **Callbacks** (`before_save`, `after_create`, etc.)
- **Authentication** (Devise gem, or roll your own with `has_secure_password`)
- **Background jobs** (ActiveJob + Sidekiq for async tasks)
- **Rails console** (`rails c` — your best debugging tool)
- **Environments & credentials** (`config/credentials.yml.enc` for secrets)
- **API-only mode** (`rails new --api` — strips unused middleware for pure backends)
- **Gems & Bundler** (`Gemfile`, `bundle install` — Rails' package management) [npm / package.json]
- **CORS configuration** (`rack-cors` gem — essential when Vue and Rails are on different ports) [cors npm package]
- **Error handling** (`rescue_from` in controllers — return proper error responses)
- **N+1 query prevention** (`includes` / eager loading — a very common Rails performance pitfall)
- **Service objects** (plain Ruby classes for complex business logic — keeps controllers thin)
- **Testing** (RSpec or Minitest — Rails has strong testing conventions baked in)
- **Pagination** (`pagy` or `kaminari` gems — for large data sets)
- **Rack & Middleware** (the layer Rails sits on — useful to understand for things like logging, auth headers)
- **Active Storage** (built-in file upload handling — if your app needs images/attachments)
