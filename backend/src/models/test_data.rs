use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TestDataset {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TestItem {
    pub id: String,
    pub dataset_id: String,
    pub content: String,
    pub metadata: Option<String>,
    pub order_index: i64,
    pub created_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateDataset {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDataset {
    pub name: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTestItem {
    pub content: String,
    pub metadata: Option<serde_json::Value>,
    pub order_index: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTestItemsBatch {
    pub contents: Vec<String>,
}
