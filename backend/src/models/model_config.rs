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

pub fn mask_api_key(api_key: &str) -> String {
    if api_key.is_empty() {
        return String::new();
    }

    let chars: Vec<char> = api_key.chars().collect();
    if chars.len() <= 8 {
        let prefix: String = chars.iter().take(2).collect();
        let suffix: String = chars
            .iter()
            .rev()
            .take(2)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect();
        return format!("{prefix}****{suffix}");
    }

    let prefix: String = chars.iter().take(4).collect();
    let suffix: String = chars
        .iter()
        .rev()
        .take(4)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    format!("{prefix}****{suffix}")
}

pub fn resolve_api_key_update(payload_api_key: Option<String>, existing_api_key: &str) -> String {
    match payload_api_key {
        Some(api_key) if !api_key.trim().is_empty() => api_key.trim().to_string(),
        _ => existing_api_key.to_string(),
    }
}

impl ModelConfig {
    pub fn masked(mut self) -> Self {
        self.api_key = mask_api_key(&self.api_key);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::{mask_api_key, resolve_api_key_update};

    #[test]
    fn mask_api_key_hides_middle_section() {
        assert_eq!(
            mask_api_key("sk-abcdefghijklmnopqrstuvwxyz"),
            "sk-a****wxyz"
        );
        assert_eq!(mask_api_key("abcd1234"), "ab****34");
    }

    #[test]
    fn resolve_api_key_update_keeps_existing_key_when_payload_is_blank() {
        assert_eq!(
            resolve_api_key_update(Some("   ".to_string()), "existing-secret"),
            "existing-secret"
        );
    }

    #[test]
    fn resolve_api_key_update_accepts_new_key_when_provided() {
        assert_eq!(
            resolve_api_key_update(Some("new-secret".to_string()), "existing-secret"),
            "new-secret"
        );
    }
}
