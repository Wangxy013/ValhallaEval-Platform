use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ValidationCheckpoint {
    pub id: String,
    pub task_id: String,
    pub name: String,
    pub criterion: String,
    pub order_index: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ValidationResult {
    pub id: String,
    pub eval_run_id: String,
    pub checkpoint_id: String,
    pub status: String,
    pub result: Option<String>,
    pub annotations: Option<String>,
    pub comment: Option<String>,
    pub created_at: i64,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Annotation {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateCheckpoint {
    pub name: String,
    pub criterion: String,
    pub order_index: Option<i64>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct UpdateValidationResult {
    pub status: Option<String>,
    pub result: Option<String>,
    pub annotations: Option<Vec<Annotation>>,
    pub comment: Option<String>,
}
