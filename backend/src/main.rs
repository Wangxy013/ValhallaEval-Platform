mod db;
mod error;
mod llm;
mod models;
mod routes;

use axum::{
    routing::{delete, get, post, put},
    Router,
};
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load .env file
    dotenv::dotenv().ok();

    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let database_url =
        std::env::var("DATABASE_URL").unwrap_or_else(|_| "postgresql://postgres:password@localhost:5432/eval_tools".to_string());
    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse()
        .unwrap_or(8080);

    tracing::info!("Connecting to database: {}", database_url);
    let pool = db::create_pool(&database_url).await?;

    tracing::info!("Running migrations");
    db::run_migrations(&pool).await?;

    // CORS layer — allow all origins for development
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        // Model configs
        .route("/api/v1/models", get(routes::models::list_models))
        .route("/api/v1/models", post(routes::models::create_model))
        .route("/api/v1/models/:id", get(routes::models::get_model))
        .route("/api/v1/models/:id", put(routes::models::update_model))
        .route("/api/v1/models/:id", delete(routes::models::delete_model))
        // Prompts
        .route("/api/v1/prompts", get(routes::prompts::list_prompts))
        .route("/api/v1/prompts", post(routes::prompts::create_prompt))
        .route("/api/v1/prompts/:id", get(routes::prompts::get_prompt))
        .route("/api/v1/prompts/:id", put(routes::prompts::update_prompt))
        .route("/api/v1/prompts/:id", delete(routes::prompts::delete_prompt))
        // Datasets
        .route("/api/v1/datasets", get(routes::datasets::list_datasets))
        .route("/api/v1/datasets", post(routes::datasets::create_dataset))
        .route("/api/v1/datasets/:id", get(routes::datasets::get_dataset))
        .route("/api/v1/datasets/:id", put(routes::datasets::update_dataset))
        .route("/api/v1/datasets/:id", delete(routes::datasets::delete_dataset))
        .route("/api/v1/datasets/:id/items", get(routes::datasets::list_items))
        .route("/api/v1/datasets/:id/items", post(routes::datasets::create_item))
        .route(
            "/api/v1/datasets/:id/items/:item_id",
            delete(routes::datasets::delete_item),
        )
        // Tasks
        .route("/api/v1/tasks", get(routes::tasks::list_tasks))
        .route("/api/v1/tasks", post(routes::tasks::create_task))
        .route("/api/v1/tasks/:id", get(routes::tasks::get_task))
        .route("/api/v1/tasks/:id", put(routes::tasks::update_task))
        .route("/api/v1/tasks/:id", delete(routes::tasks::delete_task))
        .route("/api/v1/tasks/:id/execute", post(routes::tasks::execute_task))
        .route("/api/v1/tasks/:id/pause", post(routes::tasks::pause_task))
        .route("/api/v1/tasks/:id/resume", post(routes::tasks::resume_task))
        .route("/api/v1/tasks/:id/runs", get(routes::tasks::get_task_runs))
        // Checkpoints
        .route(
            "/api/v1/tasks/:id/checkpoints",
            get(routes::tasks::list_checkpoints),
        )
        .route(
            "/api/v1/tasks/:id/checkpoints",
            post(routes::tasks::create_checkpoint),
        )
        .route(
            "/api/v1/tasks/:id/checkpoints/:checkpoint_id",
            put(routes::tasks::update_checkpoint),
        )
        .route(
            "/api/v1/tasks/:id/checkpoints/:checkpoint_id",
            delete(routes::tasks::delete_checkpoint),
        )
        // Validation
        .route("/api/v1/tasks/:id/validate", post(routes::tasks::validate_task))
        // Assessment
        .route(
            "/api/v1/tasks/:id/assessment",
            get(routes::tasks::get_assessment),
        )
        .route(
            "/api/v1/tasks/:id/assessment",
            post(routes::tasks::create_assessment),
        )
        .route(
            "/api/v1/tasks/:id/assess",
            post(routes::tasks::auto_assess_task),
        )
        .route(
            "/api/v1/tasks/:id/assess/manual",
            post(routes::tasks::manual_assess_task),
        )
        // Results
        .route(
            "/api/v1/tasks/:id/results/overview",
            get(routes::tasks::get_results_overview),
        )
        .route(
            "/api/v1/tasks/:id/results/details",
            get(routes::tasks::get_results_details),
        )
        .route(
            "/api/v1/tasks/:id/progress",
            get(routes::tasks::get_task_progress),
        )
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(pool);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
