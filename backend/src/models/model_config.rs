use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ModelConfig {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub api_key: String,
    pub api_url: String,
    pub model_id: String,
    pub extra_config: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateModelConfig {
    pub name: String,
    pub provider: String,
    pub api_key: String,
    pub api_url: String,
    pub model_id: String,
    pub extra_config: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateModelConfig {
    pub name: Option<String>,
    pub provider: Option<String>,
    pub api_key: Option<String>,
    pub api_url: Option<String>,
    pub model_id: Option<String>,
    pub extra_config: Option<serde_json::Value>,
}
