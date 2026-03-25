mod db;
mod error;
mod llm;
mod models;
mod routes;

use axum::{
    http::StatusCode,
    routing::{delete, get, post, put},
    Router,
};
use sqlx::PgPool;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

async fn healthcheck() -> StatusCode {
    StatusCode::OK
}

fn api_v1_routes() -> Router<PgPool> {
    Router::new()
        // Model configs
        .route("/models", get(routes::models::list_models))
        .route("/models", post(routes::models::create_model))
        .route("/models/:id", get(routes::models::get_model))
        .route("/models/:id", put(routes::models::update_model))
        .route("/models/:id", delete(routes::models::delete_model))
        // Prompts
        .route("/prompts", get(routes::prompts::list_prompts))
        .route("/prompts", post(routes::prompts::create_prompt))
        .route("/prompts/:id", get(routes::prompts::get_prompt))
        .route("/prompts/:id", put(routes::prompts::update_prompt))
        .route("/prompts/:id", delete(routes::prompts::delete_prompt))
        // Datasets
        .route("/datasets", get(routes::datasets::list_datasets))
        .route("/datasets", post(routes::datasets::create_dataset))
        .route("/datasets/:id", get(routes::datasets::get_dataset))
        .route("/datasets/:id", put(routes::datasets::update_dataset))
        .route("/datasets/:id", delete(routes::datasets::delete_dataset))
        .route("/datasets/:id/items", get(routes::datasets::list_items))
        .route("/datasets/:id/items", post(routes::datasets::create_item))
        .route(
            "/datasets/:id/items/:item_id",
            delete(routes::datasets::delete_item),
        )
        // Tasks
        .route("/tasks", get(routes::tasks::list_tasks))
        .route("/tasks", post(routes::tasks::create_task))
        .route("/tasks/:id", get(routes::tasks::get_task))
        .route("/tasks/:id", put(routes::tasks::update_task))
        .route("/tasks/:id", delete(routes::tasks::delete_task))
        .route("/tasks/:id/execute", post(routes::tasks::execute_task))
        .route("/tasks/:id/pause", post(routes::tasks::pause_task))
        .route("/tasks/:id/resume", post(routes::tasks::resume_task))
        .route("/tasks/:id/runs", get(routes::tasks::get_task_runs))
        // Checkpoints
        .route("/tasks/:id/checkpoints", get(routes::tasks::list_checkpoints))
        .route("/tasks/:id/checkpoints", post(routes::tasks::create_checkpoint))
        .route(
            "/tasks/:id/checkpoints/:checkpoint_id",
            put(routes::tasks::update_checkpoint),
        )
        .route(
            "/tasks/:id/checkpoints/:checkpoint_id",
            delete(routes::tasks::delete_checkpoint),
        )
        // Validation
        .route("/tasks/:id/validate", post(routes::tasks::validate_task))
        // Assessment
        .route("/tasks/:id/assessment", get(routes::tasks::get_assessment))
        .route("/tasks/:id/assessment", post(routes::tasks::create_assessment))
        .route("/tasks/:id/assess", post(routes::tasks::auto_assess_task))
        .route(
            "/tasks/:id/assess/manual",
            post(routes::tasks::manual_assess_task),
        )
        // Results
        .route(
            "/tasks/:id/results/overview",
            get(routes::tasks::get_results_overview),
        )
        .route(
            "/tasks/:id/results/details",
            get(routes::tasks::get_results_details),
        )
        .route("/tasks/:id/progress", get(routes::tasks::get_task_progress))
}

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

    let api_v1 = api_v1_routes();
    let app = Router::new()
        .route("/health", get(healthcheck))
        .nest("/api/v1", api_v1.clone())
        .nest("/v1", api_v1)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(pool);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
