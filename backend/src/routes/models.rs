use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use chrono::Utc;
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::{AppError, AppJson, AppResult};
use crate::models::{resolve_api_key_update, CreateModelConfig, ModelConfig, UpdateModelConfig};

pub async fn list_models(State(pool): State<PgPool>) -> AppResult<Json<Value>> {
    let models = sqlx::query_as::<_, ModelConfig>(
        "SELECT id, name, provider, api_key, api_url, model_id, extra_config, created_at, updated_at FROM model_configs ORDER BY created_at DESC"
    )
    .fetch_all(&pool)
    .await?;

    let masked_models: Vec<ModelConfig> = models.into_iter().map(ModelConfig::masked).collect();

    Ok(Json(json!({ "success": true, "data": masked_models })))
}

pub async fn create_model(
    State(pool): State<PgPool>,
    AppJson(payload): AppJson<CreateModelConfig>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp();
    let extra_config = payload.extra_config.as_ref().map(|v| v.to_string());

    sqlx::query(
        "INSERT INTO model_configs (id, name, provider, api_key, api_url, model_id, extra_config, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)"
    )
    .bind(&id)
    .bind(&payload.name)
    .bind(&payload.provider)
    .bind(&payload.api_key)
    .bind(&payload.api_url)
    .bind(&payload.model_id)
    .bind(&extra_config)
    .bind(now)
    .bind(now)
    .execute(&pool)
    .await?;

    let model = sqlx::query_as::<_, ModelConfig>(
        "SELECT id, name, provider, api_key, api_url, model_id, extra_config, created_at, updated_at FROM model_configs WHERE id = $1"
    )
    .bind(&id)
    .fetch_one(&pool)
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({ "success": true, "data": model.masked() })),
    ))
}

pub async fn get_model(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let model = sqlx::query_as::<_, ModelConfig>(
        "SELECT id, name, provider, api_key, api_url, model_id, extra_config, created_at, updated_at FROM model_configs WHERE id = $1"
    )
    .bind(&id)
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Model config {} not found", id)))?;

    Ok(Json(json!({ "success": true, "data": model.masked() })))
}

pub async fn update_model(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
    AppJson(payload): AppJson<UpdateModelConfig>,
) -> AppResult<Json<Value>> {
    let existing = sqlx::query_as::<_, ModelConfig>(
        "SELECT id, name, provider, api_key, api_url, model_id, extra_config, created_at, updated_at FROM model_configs WHERE id = $1"
    )
    .bind(&id)
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Model config {} not found", id)))?;

    let name = payload.name.unwrap_or(existing.name);
    let provider = payload.provider.unwrap_or(existing.provider);
    let api_key = resolve_api_key_update(payload.api_key, &existing.api_key);
    let api_url = payload.api_url.unwrap_or(existing.api_url);
    let model_id = payload.model_id.unwrap_or(existing.model_id);
    let extra_config = payload
        .extra_config
        .as_ref()
        .map(|v| v.to_string())
        .or(existing.extra_config);
    let now = Utc::now().timestamp();

    sqlx::query(
        "UPDATE model_configs SET name=$1, provider=$2, api_key=$3, api_url=$4, model_id=$5, extra_config=$6, updated_at=$7 WHERE id=$8"
    )
    .bind(&name)
    .bind(&provider)
    .bind(&api_key)
    .bind(&api_url)
    .bind(&model_id)
    .bind(&extra_config)
    .bind(now)
    .bind(&id)
    .execute(&pool)
    .await?;

    let model = sqlx::query_as::<_, ModelConfig>(
        "SELECT id, name, provider, api_key, api_url, model_id, extra_config, created_at, updated_at FROM model_configs WHERE id = $1"
    )
    .bind(&id)
    .fetch_one(&pool)
    .await?;

    Ok(Json(json!({ "success": true, "data": model.masked() })))
}

pub async fn delete_model(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    // Check for active task references
    let refs: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM task_models WHERE model_config_id = $1")
            .bind(&id)
            .fetch_one(&pool)
            .await?;
    if refs.0 > 0 {
        return Err(AppError::Conflict(format!(
            "该模型已被 {} 个评测任务引用，删除前请先删除相关任务",
            refs.0
        )));
    }

    let result = sqlx::query("DELETE FROM model_configs WHERE id = $1")
        .bind(&id)
        .execute(&pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Model config {} not found", id)));
    }

    Ok(Json(json!({ "success": true, "data": null })))
}
