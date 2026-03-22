use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Prompt {
    pub id: String,
    pub name: String,
    pub version: String,
    pub content: String,
    pub change_notes: Option<String>,
    pub parent_id: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreatePrompt {
    pub name: String,
    pub version: String,
    pub content: String,
    pub change_notes: Option<String>,
    pub parent_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePrompt {
    pub name: Option<String>,
    pub version: Option<String>,
    pub content: Option<String>,
    pub change_notes: Option<String>,
}
