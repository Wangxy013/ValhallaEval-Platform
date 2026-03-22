use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use chrono::Utc;
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::models::{CreatePrompt, Prompt, UpdatePrompt};

pub async fn list_prompts(State(pool): State<PgPool>) -> AppResult<Json<Value>> {
    let prompts = sqlx::query_as::<_, Prompt>(
        "SELECT id, name, version, content, change_notes, parent_id, created_at, updated_at FROM prompts ORDER BY created_at DESC"
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(json!({ "success": true, "data": prompts })))
}

pub async fn create_prompt(
    State(pool): State<PgPool>,
    Json(payload): Json<CreatePrompt>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp();

    sqlx::query(
        "INSERT INTO prompts (id, name, version, content, change_notes, parent_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"
    )
    .bind(&id)
    .bind(&payload.name)
    .bind(&payload.version)
    .bind(&payload.content)
    .bind(&payload.change_notes)
    .bind(&payload.parent_id)
    .bind(now)
    .bind(now)
    .execute(&pool)
    .await?;

    let prompt = sqlx::query_as::<_, Prompt>(
        "SELECT id, name, version, content, change_notes, parent_id, created_at, updated_at FROM prompts WHERE id = $1"
    )
    .bind(&id)
    .fetch_one(&pool)
    .await?;

    Ok((StatusCode::CREATED, Json(json!({ "success": true, "data": prompt }))))
}

pub async fn get_prompt(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let prompt = sqlx::query_as::<_, Prompt>(
        "SELECT id, name, version, content, change_notes, parent_id, created_at, updated_at FROM prompts WHERE id = $1"
    )
    .bind(&id)
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Prompt {} not found", id)))?;

    Ok(Json(json!({ "success": true, "data": prompt })))
}

pub async fn update_prompt(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
    Json(payload): Json<UpdatePrompt>,
) -> AppResult<Json<Value>> {
    let existing = sqlx::query_as::<_, Prompt>(
        "SELECT id, name, version, content, change_notes, parent_id, created_at, updated_at FROM prompts WHERE id = $1"
    )
    .bind(&id)
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Prompt {} not found", id)))?;

    let name = payload.name.unwrap_or(existing.name);
    let version = payload.version.unwrap_or(existing.version);
    let content = payload.content.unwrap_or(existing.content);
    let change_notes = payload.change_notes.or(existing.change_notes);
    let now = Utc::now().timestamp();

    sqlx::query(
        "UPDATE prompts SET name=$1, version=$2, content=$3, change_notes=$4, updated_at=$5 WHERE id=$6"
    )
    .bind(&name)
    .bind(&version)
    .bind(&content)
    .bind(&change_notes)
    .bind(now)
    .bind(&id)
    .execute(&pool)
    .await?;

    let prompt = sqlx::query_as::<_, Prompt>(
        "SELECT id, name, version, content, change_notes, parent_id, created_at, updated_at FROM prompts WHERE id = $1"
    )
    .bind(&id)
    .fetch_one(&pool)
    .await?;

    Ok(Json(json!({ "success": true, "data": prompt })))
}

pub async fn delete_prompt(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let result = sqlx::query("DELETE FROM prompts WHERE id = $1")
        .bind(&id)
        .execute(&pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Prompt {} not found", id)));
    }

    Ok(Json(json!({ "success": true, "data": null })))
}
