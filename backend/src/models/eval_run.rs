use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InputMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct EvalRun {
    pub id: String,
    pub task_id: String,
    pub task_prompt_id: Option<String>,
    pub task_model_id: String,
    pub task_test_item_id: String,
    pub repeat_index: i64,
    pub status: String,
    pub input_messages: String,
    pub output_content: Option<String>,
    pub error_message: Option<String>,
    pub tokens_used: Option<i64>,
    pub duration_ms: Option<i64>,
    pub created_at: i64,
    pub completed_at: Option<i64>,
}
