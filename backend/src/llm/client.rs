use crate::models::InputMessage;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<InputMessage>,
    stream: bool,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
    usage: Option<Usage>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: MessageContent,
}

#[derive(Debug, Deserialize)]
struct MessageContent {
    content: String,
}

#[derive(Debug, Deserialize)]
struct Usage {
    total_tokens: Option<i64>,
}

pub struct LlmCallResult {
    pub content: String,
    pub tokens_used: Option<i64>,
}

pub struct LlmClient {
    client: Client,
}

impl Clone for LlmClient {
    fn clone(&self) -> Self {
        Self { client: self.client.clone() }
    }
}

impl LlmClient {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .expect("Failed to build HTTP client");
        Self { client }
    }

    pub async fn call(
        &self,
        api_url: &str,
        api_key: &str,
        model_id: &str,
        messages: Vec<InputMessage>,
    ) -> Result<LlmCallResult, String> {
        let url = format!("{}/chat/completions", api_url.trim_end_matches('/'));

        let request = ChatRequest {
            model: model_id.to_string(),
            messages,
            stream: false,
        };

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("HTTP request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "unknown error".to_string());
            return Err(format!("LLM API error {}: {}", status, body));
        }

        let chat_response: ChatResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse LLM response: {}", e))?;

        let content = chat_response
            .choices
            .into_iter()
            .next()
            .map(|c| c.message.content)
            .unwrap_or_default();

        let tokens_used = chat_response.usage.and_then(|u| u.total_tokens);

        Ok(LlmCallResult {
            content,
            tokens_used,
        })
    }
}

impl Default for LlmClient {
    fn default() -> Self {
        Self::new()
    }
}
