use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Task {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub eval_type: String,
    pub status: String,
    pub dataset_id: Option<String>,
    pub validation_config: Option<String>,
    pub assessment_mode: String,
    pub assessment_config: Option<String>,
    pub repeat_count: i64,
    pub concurrency: i64,
    pub created_at: i64,
    pub updated_at: i64,
    pub started_at: Option<i64>,
    pub completed_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TaskPrompt {
    pub id: String,
    pub task_id: String,
    pub prompt_id: String,
    pub label: Option<String>,
    pub is_baseline: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TaskModel {
    pub id: String,
    pub task_id: String,
    pub model_config_id: String,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TaskTestItem {
    pub id: String,
    pub task_id: String,
    pub test_item_id: String,
    pub order_index: i64,
    pub content_snapshot: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateTask {
    pub name: String,
    pub description: Option<String>,
    pub eval_type: String,
    pub dataset_id: Option<String>,
    pub validation_config: Option<serde_json::Value>,
    pub assessment_mode: Option<String>,
    pub assessment_config: Option<serde_json::Value>,
    pub repeat_count: Option<i64>,
    /// Max parallel LLM calls (1-20, default 3)
    pub concurrency: Option<i64>,
    pub prompt_ids: Option<Vec<String>>,
    /// Prompt designated as the comparison baseline (prompt_comparison tasks)
    pub baseline_prompt_id: Option<String>,
    pub model_config_ids: Option<Vec<String>>,
    /// Selected test item IDs (snapshotted at creation time)
    pub test_item_ids: Option<Vec<String>>,
    /// Validation checkpoints — [{name, criterion}]
    pub validation_checkpoints: Option<Vec<serde_json::Value>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTask {
    pub name: Option<String>,
    pub description: Option<String>,
    pub eval_type: Option<String>,
    pub dataset_id: Option<String>,
    pub validation_config: Option<serde_json::Value>,
    pub assessment_mode: Option<String>,
    pub assessment_config: Option<serde_json::Value>,
    pub repeat_count: Option<i64>,
    pub prompt_ids: Option<Vec<String>>,
    pub model_config_ids: Option<Vec<String>>,
}
