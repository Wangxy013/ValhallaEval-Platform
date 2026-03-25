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
use crate::models::{
    CreateDataset, CreateTestItem, CreateTestItemsBatch, TestDataset, TestItem, UpdateDataset,
};

fn normalize_batch_contents(contents: &[String]) -> Vec<String> {
    contents
        .iter()
        .map(|content| content.trim())
        .filter(|content| !content.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

async fn ensure_dataset_exists(pool: &PgPool, dataset_id: &str) -> AppResult<()> {
    let exists: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM test_datasets WHERE id = $1")
        .bind(dataset_id)
        .fetch_one(pool)
        .await?;

    if exists.0 == 0 {
        return Err(AppError::NotFound(format!(
            "Dataset {} not found",
            dataset_id
        )));
    }

    Ok(())
}

async fn next_order_index(pool: &PgPool, dataset_id: &str) -> AppResult<i64> {
    let next: (i64,) = sqlx::query_as(
        "SELECT COALESCE(MAX(order_index), -1) + 1 FROM test_items WHERE dataset_id = $1",
    )
    .bind(dataset_id)
    .fetch_one(pool)
    .await?;

    Ok(next.0)
}

pub async fn list_datasets(State(pool): State<PgPool>) -> AppResult<Json<Value>> {
    let datasets = sqlx::query_as::<_, TestDataset>(
        "SELECT id, name, description, created_at, updated_at FROM test_datasets ORDER BY created_at DESC"
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(json!({ "success": true, "data": datasets })))
}

pub async fn create_dataset(
    State(pool): State<PgPool>,
    Json(payload): Json<CreateDataset>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp();

    sqlx::query(
        "INSERT INTO test_datasets (id, name, description, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)"
    )
    .bind(&id)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(now)
    .bind(now)
    .execute(&pool)
    .await?;

    let dataset = sqlx::query_as::<_, TestDataset>(
        "SELECT id, name, description, created_at, updated_at FROM test_datasets WHERE id = $1",
    )
    .bind(&id)
    .fetch_one(&pool)
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({ "success": true, "data": dataset })),
    ))
}

pub async fn get_dataset(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let dataset = sqlx::query_as::<_, TestDataset>(
        "SELECT id, name, description, created_at, updated_at FROM test_datasets WHERE id = $1",
    )
    .bind(&id)
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Dataset {} not found", id)))?;

    let items = sqlx::query_as::<_, TestItem>(
        "SELECT id, dataset_id, content, metadata, order_index, created_at FROM test_items WHERE dataset_id = $1 ORDER BY order_index ASC"
    )
    .bind(&id)
    .fetch_all(&pool)
    .await?;

    Ok(Json(
        json!({ "success": true, "data": { "dataset": dataset, "items": items } }),
    ))
}

pub async fn update_dataset(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateDataset>,
) -> AppResult<Json<Value>> {
    let existing = sqlx::query_as::<_, TestDataset>(
        "SELECT id, name, description, created_at, updated_at FROM test_datasets WHERE id = $1",
    )
    .bind(&id)
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Dataset {} not found", id)))?;

    let name = payload.name.unwrap_or(existing.name);
    let description = payload.description.or(existing.description);
    let now = Utc::now().timestamp();

    sqlx::query("UPDATE test_datasets SET name=$1, description=$2, updated_at=$3 WHERE id=$4")
        .bind(&name)
        .bind(&description)
        .bind(now)
        .bind(&id)
        .execute(&pool)
        .await?;

    let dataset = sqlx::query_as::<_, TestDataset>(
        "SELECT id, name, description, created_at, updated_at FROM test_datasets WHERE id = $1",
    )
    .bind(&id)
    .fetch_one(&pool)
    .await?;

    Ok(Json(json!({ "success": true, "data": dataset })))
}

pub async fn delete_dataset(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let result = sqlx::query("DELETE FROM test_datasets WHERE id = $1")
        .bind(&id)
        .execute(&pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Dataset {} not found", id)));
    }

    Ok(Json(json!({ "success": true, "data": null })))
}

pub async fn create_item(
    State(pool): State<PgPool>,
    Path(dataset_id): Path<String>,
    Json(payload): Json<CreateTestItem>,
) -> AppResult<(StatusCode, Json<Value>)> {
    ensure_dataset_exists(&pool, &dataset_id).await?;

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp();
    let metadata = payload.metadata.as_ref().map(|v| v.to_string());
    let order_index = match payload.order_index {
        Some(order_index) => order_index,
        None => next_order_index(&pool, &dataset_id).await?,
    };

    sqlx::query(
        "INSERT INTO test_items (id, dataset_id, content, metadata, order_index, created_at) VALUES ($1, $2, $3, $4, $5, $6)"
    )
    .bind(&id)
    .bind(&dataset_id)
    .bind(&payload.content)
    .bind(&metadata)
    .bind(order_index)
    .bind(now)
    .execute(&pool)
    .await?;

    let item = sqlx::query_as::<_, TestItem>(
        "SELECT id, dataset_id, content, metadata, order_index, created_at FROM test_items WHERE id = $1"
    )
    .bind(&id)
    .fetch_one(&pool)
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({ "success": true, "data": item })),
    ))
}

pub async fn create_items_batch(
    State(pool): State<PgPool>,
    Path(dataset_id): Path<String>,
    Json(payload): Json<CreateTestItemsBatch>,
) -> AppResult<(StatusCode, Json<Value>)> {
    ensure_dataset_exists(&pool, &dataset_id).await?;

    let contents = normalize_batch_contents(&payload.contents);
    if contents.is_empty() {
        return Err(AppError::BadRequest("至少需要一条有效测试数据".to_string()));
    }

    let start_order_index = next_order_index(&pool, &dataset_id).await?;
    let now = Utc::now().timestamp();
    let mut created_items = Vec::with_capacity(contents.len());

    for (offset, content) in contents.iter().enumerate() {
        let id = Uuid::new_v4().to_string();
        let order_index = start_order_index + offset as i64;

        sqlx::query(
            "INSERT INTO test_items (id, dataset_id, content, metadata, order_index, created_at) VALUES ($1, $2, $3, $4, $5, $6)"
        )
        .bind(&id)
        .bind(&dataset_id)
        .bind(content)
        .bind(Option::<String>::None)
        .bind(order_index)
        .bind(now)
        .execute(&pool)
        .await?;

        created_items.push(TestItem {
            id,
            dataset_id: dataset_id.clone(),
            content: content.clone(),
            metadata: None,
            order_index,
            created_at: now,
        });
    }

    Ok((
        StatusCode::CREATED,
        Json(json!({ "success": true, "data": created_items })),
    ))
}

pub async fn list_items(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let items = sqlx::query_as::<_, TestItem>(
        "SELECT id, dataset_id, content, metadata, order_index, created_at FROM test_items WHERE dataset_id = $1 ORDER BY order_index ASC, created_at ASC"
    )
    .bind(&id)
    .fetch_all(&pool)
    .await?;

    Ok(Json(json!({ "success": true, "data": items })))
}

pub async fn delete_item(
    State(pool): State<PgPool>,
    Path((dataset_id, item_id)): Path<(String, String)>,
) -> AppResult<Json<Value>> {
    let result = sqlx::query("DELETE FROM test_items WHERE id = $1 AND dataset_id = $2")
        .bind(&item_id)
        .bind(&dataset_id)
        .execute(&pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Item {} not found", item_id)));
    }

    Ok(Json(json!({ "success": true, "data": null })))
}

#[cfg(test)]
mod tests {
    use super::normalize_batch_contents;

    #[test]
    fn normalize_batch_contents_trims_and_skips_empty_rows() {
        let contents = vec![
            "  第一题  ".to_string(),
            "".to_string(),
            "   ".to_string(),
            "第二题".to_string(),
        ];

        assert_eq!(
            normalize_batch_contents(&contents),
            vec!["第一题", "第二题"]
        );
    }
}
