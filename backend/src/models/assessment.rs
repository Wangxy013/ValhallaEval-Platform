use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AssessmentResult {
    pub id: String,
    pub eval_run_id: String,
    pub mode: String,
    pub score: Option<f64>,
    pub comment: Option<String>,
    pub details: Option<String>,
    pub assessor: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateAssessmentResult {
    pub eval_run_id: String,
    pub mode: String,
    pub score: Option<f64>,
    pub comment: Option<String>,
    pub details: Option<serde_json::Value>,
    pub assessor: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ManualAssessRequest {
    pub eval_run_id: String,
    pub score: Option<f64>,
    pub comment: Option<String>,
    pub details: Option<serde_json::Value>,
}
