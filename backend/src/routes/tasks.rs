use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use chrono::Utc;
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::{AppError, AppJson, AppResult};
use crate::llm::LlmClient;
use crate::models::{
    AssessmentResult, CreateCheckpoint, CreateTask, EvalRun, InputMessage, ManualAssessRequest,
    ModelConfig, Prompt, Task, TaskModel, TaskPrompt, TaskTestItem, UpdateTask,
    ValidationCheckpoint, ValidationResult,
};

pub async fn list_tasks(State(pool): State<PgPool>) -> AppResult<Json<Value>> {
    let tasks = sqlx::query_as::<_, Task>(
        "SELECT id, name, description, eval_type, status, dataset_id, validation_config, assessment_mode, assessment_config, repeat_count, created_at, updated_at, started_at, completed_at FROM tasks ORDER BY created_at DESC"
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(json!({ "success": true, "data": tasks })))
}

pub async fn create_task(
    State(pool): State<PgPool>,
    AppJson(payload): AppJson<CreateTask>,
) -> AppResult<(StatusCode, Json<Value>)> {
    // --- Input validation ---
    if payload.name.trim().is_empty() {
        return Err(AppError::BadRequest("任务名称不能为空".to_string()));
    }
    if !["prompt_comparison", "model_comparison"].contains(&payload.eval_type.as_str()) {
        return Err(AppError::BadRequest(
            "eval_type 必须是 'prompt_comparison' 或 'model_comparison'".to_string(),
        ));
    }
    // Validate referenced model configs exist
    if let Some(model_ids) = &payload.model_config_ids {
        for model_id in model_ids {
            let exists: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM model_configs WHERE id = $1"
            )
            .bind(model_id)
            .fetch_one(&pool)
            .await?;
            if exists.0 == 0 {
                return Err(AppError::BadRequest(format!("模型配置不存在: {}", model_id)));
            }
        }
    }
    // Validate referenced prompts exist
    if let Some(prompt_ids) = &payload.prompt_ids {
        for prompt_id in prompt_ids {
            let exists: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM prompts WHERE id = $1"
            )
            .bind(prompt_id)
            .fetch_one(&pool)
            .await?;
            if exists.0 == 0 {
                return Err(AppError::BadRequest(format!("Prompt 不存在: {}", prompt_id)));
            }
        }
    }
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp();
    let validation_config = payload.validation_config.as_ref().map(|v| v.to_string());
    let assessment_config = payload.assessment_config.as_ref().map(|v| v.to_string());
    let assessment_mode = payload.assessment_mode.unwrap_or_else(|| "manual".to_string());
    let repeat_count = payload.repeat_count.unwrap_or(1);

    sqlx::query(
        "INSERT INTO tasks (id, name, description, eval_type, status, dataset_id, validation_config, assessment_mode, assessment_config, repeat_count, created_at, updated_at) VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8, $9, $10, $11)"
    )
    .bind(&id)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(&payload.eval_type)
    .bind(&payload.dataset_id)
    .bind(&validation_config)
    .bind(&assessment_mode)
    .bind(&assessment_config)
    .bind(repeat_count)
    .bind(now)
    .bind(now)
    .execute(&pool)
    .await?;

    if let Some(prompt_ids) = &payload.prompt_ids {
        for prompt_id in prompt_ids {
            let tp_id = Uuid::new_v4().to_string();
            sqlx::query("INSERT INTO task_prompts (id, task_id, prompt_id) VALUES ($1, $2, $3)")
                .bind(&tp_id)
                .bind(&id)
                .bind(prompt_id)
                .execute(&pool)
                .await?;
        }
    }

    if let Some(model_ids) = &payload.model_config_ids {
        for model_id in model_ids {
            let tm_id = Uuid::new_v4().to_string();
            sqlx::query("INSERT INTO task_models (id, task_id, model_config_id) VALUES ($1, $2, $3)")
                .bind(&tm_id)
                .bind(&id)
                .bind(model_id)
                .execute(&pool)
                .await?;
        }
    }

    // Snapshot selected test items at task creation time (data is locked from this point)
    if let Some(item_ids) = &payload.test_item_ids {
        for (idx, item_id) in item_ids.iter().enumerate() {
            let content: Option<(String,)> = sqlx::query_as(
                "SELECT content FROM test_items WHERE id = $1"
            )
            .bind(item_id)
            .fetch_optional(&pool)
            .await
            .ok()
            .flatten();

            if let Some((content,)) = content {
                let tti_id = Uuid::new_v4().to_string();
                sqlx::query(
                    "INSERT INTO task_test_items (id, task_id, test_item_id, order_index, content_snapshot) VALUES ($1, $2, $3, $4, $5)"
                )
                .bind(&tti_id)
                .bind(&id)
                .bind(item_id)
                .bind(idx as i64)
                .bind(&content)
                .execute(&pool)
                .await?;
            }
        }
    }

    // Save validation checkpoints
    if let Some(checkpoints) = &payload.validation_checkpoints {
        for (idx, cp) in checkpoints.iter().enumerate() {
            let name = cp["name"].as_str().unwrap_or("").to_string();
            let criterion = cp["criterion"].as_str().unwrap_or("").to_string();
            if name.is_empty() {
                continue;
            }
            let cp_id = Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO validation_checkpoints (id, task_id, name, criterion, order_index) VALUES ($1, $2, $3, $4, $5)"
            )
            .bind(&cp_id)
            .bind(&id)
            .bind(&name)
            .bind(&criterion)
            .bind(idx as i64)
            .execute(&pool)
            .await?;
        }
    }

    let task = get_task_with_associations(&pool, &id).await?;
    Ok((StatusCode::CREATED, Json(json!({ "success": true, "data": task }))))
}

pub async fn get_task(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let task = get_task_with_associations(&pool, &id).await?;
    Ok(Json(json!({ "success": true, "data": task })))
}

async fn get_task_with_associations(pool: &PgPool, id: &str) -> AppResult<Value> {
    let task = sqlx::query_as::<_, Task>(
        "SELECT id, name, description, eval_type, status, dataset_id, validation_config, assessment_mode, assessment_config, repeat_count, created_at, updated_at, started_at, completed_at FROM tasks WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Task {} not found", id)))?;

    let prompts = sqlx::query_as::<_, TaskPrompt>(
        "SELECT id, task_id, prompt_id, label FROM task_prompts WHERE task_id = $1"
    )
    .bind(id)
    .fetch_all(pool)
    .await?;

    let models = sqlx::query_as::<_, TaskModel>(
        "SELECT id, task_id, model_config_id, label FROM task_models WHERE task_id = $1"
    )
    .bind(id)
    .fetch_all(pool)
    .await?;

    let test_items = sqlx::query_as::<_, TaskTestItem>(
        "SELECT id, task_id, test_item_id, order_index, content_snapshot FROM task_test_items WHERE task_id = $1 ORDER BY order_index ASC"
    )
    .bind(id)
    .fetch_all(pool)
    .await?;

    Ok(json!({
        "task": task,
        "prompts": prompts,
        "models": models,
        "test_items": test_items
    }))
}

pub async fn update_task(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
    AppJson(payload): AppJson<UpdateTask>,
) -> AppResult<Json<Value>> {
    let existing = sqlx::query_as::<_, Task>(
        "SELECT id, name, description, eval_type, status, dataset_id, validation_config, assessment_mode, assessment_config, repeat_count, created_at, updated_at, started_at, completed_at FROM tasks WHERE id = $1"
    )
    .bind(&id)
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Task {} not found", id)))?;

    let name = payload.name.unwrap_or(existing.name);
    let description = payload.description.or(existing.description);
    let eval_type = payload.eval_type.unwrap_or(existing.eval_type);
    let dataset_id = payload.dataset_id.or(existing.dataset_id);
    let validation_config = payload
        .validation_config
        .as_ref()
        .map(|v| v.to_string())
        .or(existing.validation_config);
    let assessment_mode = payload.assessment_mode.unwrap_or(existing.assessment_mode);
    let assessment_config = payload
        .assessment_config
        .as_ref()
        .map(|v| v.to_string())
        .or(existing.assessment_config);
    let repeat_count = payload.repeat_count.unwrap_or(existing.repeat_count);
    let now = Utc::now().timestamp();

    sqlx::query(
        "UPDATE tasks SET name=$1, description=$2, eval_type=$3, dataset_id=$4, validation_config=$5, assessment_mode=$6, assessment_config=$7, repeat_count=$8, updated_at=$9 WHERE id=$10"
    )
    .bind(&name)
    .bind(&description)
    .bind(&eval_type)
    .bind(&dataset_id)
    .bind(&validation_config)
    .bind(&assessment_mode)
    .bind(&assessment_config)
    .bind(repeat_count)
    .bind(now)
    .bind(&id)
    .execute(&pool)
    .await?;

    if let Some(prompt_ids) = &payload.prompt_ids {
        sqlx::query("DELETE FROM task_prompts WHERE task_id = $1")
            .bind(&id)
            .execute(&pool)
            .await?;
        for prompt_id in prompt_ids {
            let tp_id = Uuid::new_v4().to_string();
            sqlx::query("INSERT INTO task_prompts (id, task_id, prompt_id) VALUES ($1, $2, $3)")
                .bind(&tp_id)
                .bind(&id)
                .bind(prompt_id)
                .execute(&pool)
                .await?;
        }
    }

    if let Some(model_ids) = &payload.model_config_ids {
        sqlx::query("DELETE FROM task_models WHERE task_id = $1")
            .bind(&id)
            .execute(&pool)
            .await?;
        for model_id in model_ids {
            let tm_id = Uuid::new_v4().to_string();
            sqlx::query("INSERT INTO task_models (id, task_id, model_config_id) VALUES ($1, $2, $3)")
                .bind(&tm_id)
                .bind(&id)
                .bind(model_id)
                .execute(&pool)
                .await?;
        }
    }

    let task = get_task_with_associations(&pool, &id).await?;
    Ok(Json(json!({ "success": true, "data": task })))
}

pub async fn delete_task(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let result = sqlx::query("DELETE FROM tasks WHERE id = $1")
        .bind(&id)
        .execute(&pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Task {} not found", id)));
    }

    Ok(Json(json!({ "success": true, "data": null })))
}

pub async fn execute_task(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let task = sqlx::query_as::<_, Task>(
        "SELECT id, name, description, eval_type, status, dataset_id, validation_config, assessment_mode, assessment_config, repeat_count, created_at, updated_at, started_at, completed_at FROM tasks WHERE id = $1"
    )
    .bind(&id)
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Task {} not found", id)))?;

    if task.status == "running" {
        return Err(AppError::Conflict("Task is already running".to_string()));
    }

    let task_models = sqlx::query_as::<_, TaskModel>(
        "SELECT id, task_id, model_config_id, label FROM task_models WHERE task_id = $1"
    )
    .bind(&id)
    .fetch_all(&pool)
    .await?;

    if task_models.is_empty() {
        return Err(AppError::BadRequest("Task has no models configured".to_string()));
    }

    let task_prompts = sqlx::query_as::<_, TaskPrompt>(
        "SELECT id, task_id, prompt_id, label FROM task_prompts WHERE task_id = $1"
    )
    .bind(&id)
    .fetch_all(&pool)
    .await?;

    // Use pre-snapshotted items from task creation; fall back to full dataset for legacy tasks
    let existing_tti: Vec<(String, String)> = sqlx::query_as(
        "SELECT id, content_snapshot FROM task_test_items WHERE task_id = $1 ORDER BY order_index ASC"
    )
    .bind(&id)
    .fetch_all(&pool)
    .await
    .unwrap_or_default();

    let task_test_item_ids: Vec<(String, String)> = if !existing_tti.is_empty() {
        // Items were snapshotted at creation — use them as-is
        existing_tti
    } else {
        // Legacy path: load all items from dataset and snapshot now
        let raw_items = if let Some(dataset_id) = &task.dataset_id {
            sqlx::query_as::<_, (String, String)>(
                "SELECT id, content FROM test_items WHERE dataset_id = $1 ORDER BY order_index ASC"
            )
            .bind(dataset_id)
            .fetch_all(&pool)
            .await?
        } else {
            vec![]
        };

        if raw_items.is_empty() {
            return Err(AppError::BadRequest("Task has no test items".to_string()));
        }

        let mut snapshotted = Vec::new();
        for (idx, (item_id, item_content)) in raw_items.iter().enumerate() {
            let tti_id = Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO task_test_items (id, task_id, test_item_id, order_index, content_snapshot) VALUES ($1, $2, $3, $4, $5)"
            )
            .bind(&tti_id)
            .bind(&id)
            .bind(item_id)
            .bind(idx as i64)
            .bind(item_content)
            .execute(&pool)
            .await?;
            snapshotted.push((tti_id, item_content.clone()));
        }
        snapshotted
    };

    if task_test_item_ids.is_empty() {
        return Err(AppError::BadRequest("Task has no test items".to_string()));
    }

    let now = Utc::now().timestamp();
    sqlx::query("UPDATE tasks SET status='running', started_at=$1, updated_at=$2 WHERE id=$3")
        .bind(now)
        .bind(now)
        .bind(&id)
        .execute(&pool)
        .await?;

    let mut model_map: std::collections::HashMap<String, ModelConfig> = std::collections::HashMap::new();
    for tm in &task_models {
        let model_cfg = sqlx::query_as::<_, ModelConfig>(
            "SELECT id, name, provider, api_key, api_url, model_id, extra_config, created_at, updated_at FROM model_configs WHERE id = $1"
        )
        .bind(&tm.model_config_id)
        .fetch_optional(&pool)
        .await?;
        if let Some(cfg) = model_cfg {
            model_map.insert(tm.id.clone(), cfg);
        }
    }

    let mut prompt_map: std::collections::HashMap<String, Prompt> = std::collections::HashMap::new();
    for tp in &task_prompts {
        let prompt = sqlx::query_as::<_, Prompt>(
            "SELECT id, name, version, content, change_notes, parent_id, created_at, updated_at FROM prompts WHERE id = $1"
        )
        .bind(&tp.prompt_id)
        .fetch_optional(&pool)
        .await?;
        if let Some(p) = prompt {
            prompt_map.insert(tp.id.clone(), p);
        }
    }

    let pool_clone = pool.clone();
    let task_id = id.clone();
    let repeat_count = task.repeat_count;

    tokio::spawn(async move {
        let llm_client = LlmClient::new();

        let prompt_entries: Vec<Option<(String, String)>> = if task_prompts.is_empty() {
            vec![None]
        } else {
            task_prompts
                .iter()
                .map(|tp| {
                    prompt_map
                        .get(&tp.id)
                        .map(|p| (tp.id.clone(), p.content.clone()))
                })
                .collect()
        };

        for (tti_id, item_content) in &task_test_item_ids {
            for tm in &task_models {
                let model_cfg = match model_map.get(&tm.id) {
                    Some(c) => c,
                    None => continue,
                };

                for prompt_entry in &prompt_entries {
                    for repeat_idx in 0..repeat_count {
                        let run_id = Uuid::new_v4().to_string();
                        let created_at = Utc::now().timestamp();

                        let mut messages: Vec<InputMessage> = Vec::new();
                        let task_prompt_id: Option<String>;

                        if let Some((tp_id, prompt_content)) = prompt_entry {
                            messages.push(InputMessage {
                                role: "system".to_string(),
                                content: prompt_content.clone(),
                            });
                            task_prompt_id = Some(tp_id.clone());
                        } else {
                            task_prompt_id = None;
                        }

                        messages.push(InputMessage {
                            role: "user".to_string(),
                            content: item_content.clone(),
                        });

                        let input_messages_json = serde_json::to_string(&messages)
                            .unwrap_or_else(|_| "[]".to_string());

                        let _ = sqlx::query(
                            "INSERT INTO eval_runs (id, task_id, task_prompt_id, task_model_id, task_test_item_id, repeat_index, status, input_messages, created_at) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8)"
                        )
                        .bind(&run_id)
                        .bind(&task_id)
                        .bind(&task_prompt_id)
                        .bind(&tm.id)
                        .bind(tti_id)
                        .bind(repeat_idx)
                        .bind(&input_messages_json)
                        .bind(created_at)
                        .execute(&pool_clone)
                        .await;

                        let _ = sqlx::query("UPDATE eval_runs SET status='running' WHERE id=$1")
                            .bind(&run_id)
                            .execute(&pool_clone)
                            .await;

                        let start = std::time::Instant::now();
                        let result = llm_client
                            .call(
                                &model_cfg.api_url,
                                &model_cfg.api_key,
                                &model_cfg.model_id,
                                messages,
                            )
                            .await;

                        let duration_ms = start.elapsed().as_millis() as i64;
                        let completed_at = Utc::now().timestamp();

                        match result {
                            Ok(llm_result) => {
                                let _ = sqlx::query(
                                    "UPDATE eval_runs SET status='completed', output_content=$1, tokens_used=$2, duration_ms=$3, completed_at=$4 WHERE id=$5"
                                )
                                .bind(&llm_result.content)
                                .bind(llm_result.tokens_used)
                                .bind(duration_ms)
                                .bind(completed_at)
                                .bind(&run_id)
                                .execute(&pool_clone)
                                .await;
                            }
                            Err(e) => {
                                let _ = sqlx::query(
                                    "UPDATE eval_runs SET status='failed', error_message=$1, duration_ms=$2, completed_at=$3 WHERE id=$4"
                                )
                                .bind(&e)
                                .bind(duration_ms)
                                .bind(completed_at)
                                .bind(&run_id)
                                .execute(&pool_clone)
                                .await;
                            }
                        }
                    }
                }
            }
        }

        let completed_at = Utc::now().timestamp();
        let _ = sqlx::query(
            "UPDATE tasks SET status='completed', completed_at=$1, updated_at=$2 WHERE id=$3"
        )
        .bind(completed_at)
        .bind(completed_at)
        .bind(&task_id)
        .execute(&pool_clone)
        .await;
    });

    Ok(Json(json!({ "success": true, "data": { "status": "running", "task_id": id } })))
}

pub async fn pause_task(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let now = Utc::now().timestamp();
    let result = sqlx::query(
        "UPDATE tasks SET status='paused', updated_at=$1 WHERE id=$2 AND status='running'"
    )
    .bind(now)
    .bind(&id)
    .execute(&pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::BadRequest("Task is not running".to_string()));
    }

    Ok(Json(json!({ "success": true, "data": { "status": "paused" } })))
}

pub async fn resume_task(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let now = Utc::now().timestamp();
    let result = sqlx::query(
        "UPDATE tasks SET status='running', updated_at=$1 WHERE id=$2 AND status='paused'"
    )
    .bind(now)
    .bind(&id)
    .execute(&pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::BadRequest("Task is not paused".to_string()));
    }

    Ok(Json(json!({ "success": true, "data": { "status": "running" } })))
}

pub async fn get_task_runs(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    // Verify task exists
    let task_exists: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tasks WHERE id = $1")
        .bind(&id)
        .fetch_one(&pool)
        .await?;
    if task_exists.0 == 0 {
        return Err(AppError::NotFound(format!("任务 {} 不存在", id)));
    }

    let runs = sqlx::query_as::<_, EvalRun>(
        "SELECT id, task_id, task_prompt_id, task_model_id, task_test_item_id, repeat_index, status, input_messages, output_content, error_message, tokens_used, duration_ms, created_at, completed_at FROM eval_runs WHERE task_id = $1 ORDER BY created_at ASC"
    )
    .bind(&id)
    .fetch_all(&pool)
    .await?;

    // Fetch checkpoints once to enrich validation results with name/criterion
    let task_checkpoints = sqlx::query_as::<_, ValidationCheckpoint>(
        "SELECT id, task_id, name, criterion, order_index FROM validation_checkpoints WHERE task_id = $1 ORDER BY order_index ASC"
    )
    .bind(&id)
    .fetch_all(&pool)
    .await
    .unwrap_or_default();
    let checkpoint_map: std::collections::HashMap<String, (String, String)> = task_checkpoints
        .into_iter()
        .map(|c| (c.id, (c.name, c.criterion)))
        .collect();

    let mut enriched = Vec::new();
    for run in &runs {
        // Get prompt name via task_prompt_id -> task_prompts -> prompts
        let prompt_label: Option<String> = if let Some(tp_id) = &run.task_prompt_id {
            sqlx::query_as::<_, (Option<String>, Option<String>, Option<String>)>(
                "SELECT tp.label, p.name, p.version FROM task_prompts tp LEFT JOIN prompts p ON p.id = tp.prompt_id WHERE tp.id = $1"
            )
            .bind(tp_id)
            .fetch_optional(&pool)
            .await
            .ok()
            .flatten()
            .map(|(label, name, version)| {
                label.unwrap_or_else(|| {
                    match (name, version) {
                        (Some(n), Some(v)) => format!("{} ({})", n, v),
                        (Some(n), _) => n,
                        _ => tp_id.clone(),
                    }
                })
            })
        } else {
            None
        };

        // Get model name via task_model_id -> task_models -> model_configs
        let model_label: Option<String> = sqlx::query_as::<_, (Option<String>, Option<String>)>(
            "SELECT tm.label, mc.name FROM task_models tm LEFT JOIN model_configs mc ON mc.id = tm.model_config_id WHERE tm.id = $1"
        )
        .bind(&run.task_model_id)
        .fetch_optional(&pool)
        .await
        .ok()
        .flatten()
        .map(|(label, name)| label.or(name).unwrap_or_default());

        // Get test item content snapshot
        let test_item_content: Option<String> = sqlx::query_as::<_, (String,)>(
            "SELECT content_snapshot FROM task_test_items WHERE id = $1"
        )
        .bind(&run.task_test_item_id)
        .fetch_optional(&pool)
        .await
        .ok()
        .flatten()
        .map(|(c,)| c);

        // Get assessment results
        let assessment_results = sqlx::query_as::<_, AssessmentResult>(
            "SELECT id, eval_run_id, mode, score, comment, details, assessor, created_at FROM assessment_results WHERE eval_run_id = $1"
        )
        .bind(&run.id)
        .fetch_all(&pool)
        .await
        .unwrap_or_default();

        // Get validation results enriched with checkpoint name and criterion.
        // NOTE: DB column mapping:
        //   status  → 'pass' | 'fail' | 'pending' | 'error'  (the enum decision)
        //   result  → full LLM judge response text ("PASS. The output...")
        //   comment → unused / null
        // Frontend expects: result = enum, comment = explanation text — so we swap here.
        let raw_vr = sqlx::query_as::<_, ValidationResult>(
            "SELECT id, eval_run_id, checkpoint_id, status, result, annotations, comment, created_at FROM validation_results WHERE eval_run_id = $1 ORDER BY created_at ASC"
        )
        .bind(&run.id)
        .fetch_all(&pool)
        .await
        .unwrap_or_default();
        let validation_results: Vec<Value> = raw_vr.iter().map(|vr| {
            let (cp_name, cp_criterion) = checkpoint_map.get(&vr.checkpoint_id)
                .map(|(n, c)| (Some(n.clone()), Some(c.clone())))
                .unwrap_or((None, None));
            json!({
                "id": vr.id,
                "eval_run_id": vr.eval_run_id,
                "checkpoint_id": vr.checkpoint_id,
                "checkpoint_name": cp_name,
                "checkpoint_criterion": cp_criterion,
                "status": vr.status,
                // result field carries the pass/fail enum so the frontend can use it for colour/text
                "result": vr.status,
                // comment carries the full LLM explanation (stored in the DB `result` column)
                "comment": vr.result,
                "annotations": vr.annotations,
                "created_at": vr.created_at,
            })
        }).collect();

        enriched.push(json!({
            "id": run.id,
            "task_id": run.task_id,
            "task_prompt_id": run.task_prompt_id,
            "task_model_id": run.task_model_id,
            "task_test_item_id": run.task_test_item_id,
            "repeat_index": run.repeat_index,
            "status": run.status,
            "input_messages": run.input_messages,
            "output_content": run.output_content,
            "error_message": run.error_message,
            "tokens_used": run.tokens_used,
            "duration_ms": run.duration_ms,
            "created_at": run.created_at,
            "completed_at": run.completed_at,
            "prompt_label": prompt_label,
            "model_label": model_label,
            "test_item_content": test_item_content,
            "assessment_results": assessment_results,
            "validation_results": validation_results
        }));
    }

    Ok(Json(json!({ "success": true, "data": enriched })))
}

pub async fn list_checkpoints(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let checkpoints = sqlx::query_as::<_, ValidationCheckpoint>(
        "SELECT id, task_id, name, criterion, order_index FROM validation_checkpoints WHERE task_id = $1 ORDER BY order_index ASC"
    )
    .bind(&id)
    .fetch_all(&pool)
    .await?;

    Ok(Json(json!({ "success": true, "data": checkpoints })))
}

pub async fn create_checkpoint(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
    AppJson(payload): AppJson<CreateCheckpoint>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let cp_id = Uuid::new_v4().to_string();
    // Auto-increment order_index if not explicitly provided
    let order_index = if let Some(oi) = payload.order_index {
        oi
    } else {
        let max: (Option<i64>,) = sqlx::query_as(
            "SELECT MAX(order_index) FROM validation_checkpoints WHERE task_id = $1"
        )
        .bind(&id)
        .fetch_one(&pool)
        .await
        .unwrap_or((None,));
        max.0.unwrap_or(-1) + 1
    };

    sqlx::query(
        "INSERT INTO validation_checkpoints (id, task_id, name, criterion, order_index) VALUES ($1, $2, $3, $4, $5)"
    )
    .bind(&cp_id)
    .bind(&id)
    .bind(&payload.name)
    .bind(&payload.criterion)
    .bind(order_index)
    .execute(&pool)
    .await?;

    let checkpoint = sqlx::query_as::<_, ValidationCheckpoint>(
        "SELECT id, task_id, name, criterion, order_index FROM validation_checkpoints WHERE id = $1"
    )
    .bind(&cp_id)
    .fetch_one(&pool)
    .await?;

    Ok((StatusCode::CREATED, Json(json!({ "success": true, "data": checkpoint }))))
}

pub async fn update_checkpoint(
    State(pool): State<PgPool>,
    Path((task_id, checkpoint_id)): Path<(String, String)>,
    AppJson(payload): AppJson<CreateCheckpoint>,
) -> AppResult<Json<Value>> {
    let order_index = payload.order_index.unwrap_or(0);
    let result = sqlx::query(
        "UPDATE validation_checkpoints SET name=$1, criterion=$2, order_index=$3 WHERE id=$4 AND task_id=$5"
    )
    .bind(&payload.name)
    .bind(&payload.criterion)
    .bind(order_index)
    .bind(&checkpoint_id)
    .bind(&task_id)
    .execute(&pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Checkpoint {} not found", checkpoint_id)));
    }

    let checkpoint = sqlx::query_as::<_, ValidationCheckpoint>(
        "SELECT id, task_id, name, criterion, order_index FROM validation_checkpoints WHERE id = $1"
    )
    .bind(&checkpoint_id)
    .fetch_one(&pool)
    .await?;

    Ok(Json(json!({ "success": true, "data": checkpoint })))
}

pub async fn delete_checkpoint(
    State(pool): State<PgPool>,
    Path((task_id, checkpoint_id)): Path<(String, String)>,
) -> AppResult<Json<Value>> {
    let result = sqlx::query(
        "DELETE FROM validation_checkpoints WHERE id=$1 AND task_id=$2"
    )
    .bind(&checkpoint_id)
    .bind(&task_id)
    .execute(&pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Checkpoint {} not found", checkpoint_id)));
    }

    Ok(Json(json!({ "success": true, "data": null })))
}

pub async fn validate_task(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let checkpoints = sqlx::query_as::<_, ValidationCheckpoint>(
        "SELECT id, task_id, name, criterion, order_index FROM validation_checkpoints WHERE task_id = $1 ORDER BY order_index ASC"
    )
    .bind(&id)
    .fetch_all(&pool)
    .await?;

    if checkpoints.is_empty() {
        return Err(AppError::BadRequest("Task has no validation checkpoints".to_string()));
    }

    let completed_runs = sqlx::query_as::<_, EvalRun>(
        "SELECT id, task_id, task_prompt_id, task_model_id, task_test_item_id, repeat_index, status, input_messages, output_content, error_message, tokens_used, duration_ms, created_at, completed_at FROM eval_runs WHERE task_id = $1 AND status = 'completed'"
    )
    .bind(&id)
    .fetch_all(&pool)
    .await?;

    if completed_runs.is_empty() {
        return Err(AppError::BadRequest("No completed runs to validate".to_string()));
    }

    let task_model = sqlx::query_as::<_, TaskModel>(
        "SELECT id, task_id, model_config_id, label FROM task_models WHERE task_id = $1 LIMIT 1"
    )
    .bind(&id)
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::BadRequest("Task has no models configured".to_string()))?;

    let judge_model = sqlx::query_as::<_, ModelConfig>(
        "SELECT id, name, provider, api_key, api_url, model_id, extra_config, created_at, updated_at FROM model_configs WHERE id = $1"
    )
    .bind(&task_model.model_config_id)
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::BadRequest("Judge model config not found".to_string()))?;

    let pool_clone = pool.clone();

    tokio::spawn(async move {
        let llm_client = LlmClient::new();

        for run in &completed_runs {
            let output = match &run.output_content {
                Some(o) => o.clone(),
                None => continue,
            };

            for checkpoint in &checkpoints {
                let vr_id = Uuid::new_v4().to_string();
                let created_at = Utc::now().timestamp();

                let exists: (i64,) = sqlx::query_as(
                    "SELECT COUNT(*) FROM validation_results WHERE eval_run_id=$1 AND checkpoint_id=$2"
                )
                .bind(&run.id)
                .bind(&checkpoint.id)
                .fetch_one(&pool_clone)
                .await
                .unwrap_or((0,));

                if exists.0 > 0 {
                    continue;
                }

                let _ = sqlx::query(
                    "INSERT INTO validation_results (id, eval_run_id, checkpoint_id, status, created_at) VALUES ($1, $2, $3, 'pending', $4)"
                )
                .bind(&vr_id)
                .bind(&run.id)
                .bind(&checkpoint.id)
                .bind(created_at)
                .execute(&pool_clone)
                .await;

                let validation_prompt = format!(
                    "You are evaluating an AI model's output against a specific criterion.\n\nCriterion: {}\n\nModel Output:\n{}\n\nDoes the output satisfy the criterion? Respond with PASS or FAIL followed by a brief explanation.",
                    checkpoint.criterion, output
                );

                let messages = vec![InputMessage {
                    role: "user".to_string(),
                    content: validation_prompt,
                }];

                match llm_client
                    .call(
                        &judge_model.api_url,
                        &judge_model.api_key,
                        &judge_model.model_id,
                        messages,
                    )
                    .await
                {
                    Ok(result) => {
                        let validation_status = if result.content.to_uppercase().starts_with("PASS") {
                            "pass"
                        } else {
                            "fail"
                        };
                        let _ = sqlx::query(
                            "UPDATE validation_results SET status=$1, result=$2 WHERE id=$3"
                        )
                        .bind(validation_status)
                        .bind(&result.content)
                        .bind(&vr_id)
                        .execute(&pool_clone)
                        .await;
                    }
                    Err(e) => {
                        let _ = sqlx::query(
                            "UPDATE validation_results SET status='error', result=$1 WHERE id=$2"
                        )
                        .bind(&e)
                        .bind(&vr_id)
                        .execute(&pool_clone)
                        .await;
                    }
                }
            }
        }
    });

    Ok(Json(json!({ "success": true, "data": { "message": "Validation started" } })))
}

pub async fn get_assessment(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let results = sqlx::query_as::<_, AssessmentResult>(
        "SELECT ar.id, ar.eval_run_id, ar.mode, ar.score, ar.comment, ar.details, ar.assessor, ar.created_at FROM assessment_results ar JOIN eval_runs er ON ar.eval_run_id = er.id WHERE er.task_id = $1 ORDER BY ar.created_at DESC"
    )
    .bind(&id)
    .fetch_all(&pool)
    .await?;

    Ok(Json(json!({ "success": true, "data": results })))
}

pub async fn create_assessment(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
    AppJson(payload): AppJson<ManualAssessRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let run_exists: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM eval_runs WHERE id=$1 AND task_id=$2"
    )
    .bind(&payload.eval_run_id)
    .bind(&id)
    .fetch_one(&pool)
    .await?;

    if run_exists.0 == 0 {
        return Err(AppError::NotFound("Eval run not found in this task".to_string()));
    }

    let ar_id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp();
    let details = payload.details.as_ref().map(|v| v.to_string());

    sqlx::query(
        "INSERT INTO assessment_results (id, eval_run_id, mode, score, comment, details, assessor, created_at) VALUES ($1, $2, 'manual', $3, $4, $5, 'human', $6)"
    )
    .bind(&ar_id)
    .bind(&payload.eval_run_id)
    .bind(payload.score)
    .bind(&payload.comment)
    .bind(&details)
    .bind(now)
    .execute(&pool)
    .await?;

    let result = sqlx::query_as::<_, AssessmentResult>(
        "SELECT id, eval_run_id, mode, score, comment, details, assessor, created_at FROM assessment_results WHERE id = $1"
    )
    .bind(&ar_id)
    .fetch_one(&pool)
    .await?;

    Ok((StatusCode::CREATED, Json(json!({ "success": true, "data": result }))))
}

pub async fn auto_assess_task(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let completed_runs = sqlx::query_as::<_, EvalRun>(
        "SELECT id, task_id, task_prompt_id, task_model_id, task_test_item_id, repeat_index, status, input_messages, output_content, error_message, tokens_used, duration_ms, created_at, completed_at FROM eval_runs WHERE task_id = $1 AND status = 'completed'"
    )
    .bind(&id)
    .fetch_all(&pool)
    .await?;

    if completed_runs.is_empty() {
        return Err(AppError::BadRequest("No completed runs to assess".to_string()));
    }

    let task_model = sqlx::query_as::<_, TaskModel>(
        "SELECT id, task_id, model_config_id, label FROM task_models WHERE task_id = $1 LIMIT 1"
    )
    .bind(&id)
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::BadRequest("Task has no models configured".to_string()))?;

    let judge_model = sqlx::query_as::<_, ModelConfig>(
        "SELECT id, name, provider, api_key, api_url, model_id, extra_config, created_at, updated_at FROM model_configs WHERE id = $1"
    )
    .bind(&task_model.model_config_id)
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::BadRequest("Judge model config not found".to_string()))?;

    let pool_clone = pool.clone();

    // Fetch checkpoints to make assessment criterion-aware
    let assess_checkpoints = sqlx::query_as::<_, ValidationCheckpoint>(
        "SELECT id, task_id, name, criterion, order_index FROM validation_checkpoints WHERE task_id = $1 ORDER BY order_index ASC"
    )
    .bind(&id)
    .fetch_all(&pool)
    .await
    .unwrap_or_default();

    tokio::spawn(async move {
        let llm_client = LlmClient::new();

        for run in &completed_runs {
            let output = match &run.output_content {
                Some(o) => o.clone(),
                None => continue,
            };

            let existing: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM assessment_results WHERE eval_run_id=$1 AND mode='auto'"
            )
            .bind(&run.id)
            .fetch_one(&pool_clone)
            .await
            .unwrap_or((0,));

            if existing.0 > 0 {
                continue;
            }

            let assess_prompt = if assess_checkpoints.is_empty() {
                format!(
                    "You are evaluating the quality of an AI model's response. Rate the following response on a scale from 0 to 10, where 0 is completely incorrect/unhelpful and 10 is perfect.\n\nInput messages that produced this response:\n{}\n\nModel Response:\n{}\n\nProvide your evaluation in this JSON format:\n{{\"score\": <0-10>, \"comment\": \"<brief explanation>\", \"strengths\": [\"...\"], \"weaknesses\": [\"...\"]}}",
                    run.input_messages, output
                )
            } else {
                let criteria_list = assess_checkpoints.iter().enumerate()
                    .map(|(i, cp)| format!("{}. {} — {}", i + 1, cp.name, cp.criterion))
                    .collect::<Vec<_>>()
                    .join("\n");
                let cp_score_tpl = assess_checkpoints.iter()
                    .map(|cp| format!("{{\"name\":\"{}\",\"passed\":true,\"score\":<0-10>,\"comment\":\"<explanation>\"}}", cp.name))
                    .collect::<Vec<_>>()
                    .join(", ");
                format!(
                    "You are evaluating an AI model's response against specific validation criteria.\n\nValidation Criteria:\n{}\n\nInput messages:\n{}\n\nModel Response:\n{}\n\nEvaluate the response against EACH criterion, then give an overall score.\nRespond ONLY with JSON:\n{{\"score\": <0-10>, \"comment\": \"<overall evaluation>\", \"checkpoint_scores\": [{}], \"strengths\": [\"...\"], \"weaknesses\": [\"...\"]}}",
                    criteria_list, run.input_messages, output, cp_score_tpl
                )
            };

            let messages = vec![InputMessage {
                role: "user".to_string(),
                content: assess_prompt,
            }];

            let ar_id = Uuid::new_v4().to_string();
            let now = Utc::now().timestamp();

            match llm_client
                .call(
                    &judge_model.api_url,
                    &judge_model.api_key,
                    &judge_model.model_id,
                    messages,
                )
                .await
            {
                Ok(result) => {
                    let (score, comment, details) =
                        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&result.content) {
                            let score = parsed["score"].as_f64();
                            let comment = parsed["comment"].as_str().map(|s| s.to_string());
                            (score, comment, Some(result.content.clone()))
                        } else {
                            (None, Some(result.content.clone()), None)
                        };

                    let _ = sqlx::query(
                        "INSERT INTO assessment_results (id, eval_run_id, mode, score, comment, details, assessor, created_at) VALUES ($1, $2, 'auto', $3, $4, $5, 'llm', $6)"
                    )
                    .bind(&ar_id)
                    .bind(&run.id)
                    .bind(score)
                    .bind(&comment)
                    .bind(&details)
                    .bind(now)
                    .execute(&pool_clone)
                    .await;
                }
                Err(e) => {
                    let _ = sqlx::query(
                        "INSERT INTO assessment_results (id, eval_run_id, mode, score, comment, details, assessor, created_at) VALUES ($1, $2, 'auto', NULL, $3, NULL, 'llm', $4)"
                    )
                    .bind(&ar_id)
                    .bind(&run.id)
                    .bind(&e)
                    .bind(now)
                    .execute(&pool_clone)
                    .await;
                }
            }
        }
    });

    Ok(Json(json!({ "success": true, "data": { "message": "Auto assessment started" } })))
}

pub async fn manual_assess_task(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
    AppJson(payload): AppJson<ManualAssessRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    create_assessment(State(pool), Path(id), AppJson(payload)).await
}

pub async fn get_results_overview(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    // Verify task exists
    let task_exists: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tasks WHERE id = $1")
        .bind(&id)
        .fetch_one(&pool)
        .await?;
    if task_exists.0 == 0 {
        return Err(AppError::NotFound(format!("任务 {} 不存在", id)));
    }

    let total_runs: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM eval_runs WHERE task_id=$1"
    ).bind(&id).fetch_one(&pool).await?;

    let completed_runs: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM eval_runs WHERE task_id=$1 AND status='completed'"
    ).bind(&id).fetch_one(&pool).await?;

    let failed_runs: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM eval_runs WHERE task_id=$1 AND status='failed'"
    ).bind(&id).fetch_one(&pool).await?;

    let avg_tokens: (Option<f64>,) = sqlx::query_as(
        "SELECT AVG(CAST(tokens_used AS DOUBLE PRECISION)) FROM eval_runs WHERE task_id=$1 AND status='completed'"
    ).bind(&id).fetch_one(&pool).await?;

    let avg_duration: (Option<f64>,) = sqlx::query_as(
        "SELECT AVG(CAST(duration_ms AS DOUBLE PRECISION)) FROM eval_runs WHERE task_id=$1 AND status='completed'"
    ).bind(&id).fetch_one(&pool).await?;

    let validation_pass: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM validation_results vr JOIN eval_runs er ON vr.eval_run_id=er.id WHERE er.task_id=$1 AND vr.status='pass'"
    ).bind(&id).fetch_one(&pool).await?;

    let validation_fail: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM validation_results vr JOIN eval_runs er ON vr.eval_run_id=er.id WHERE er.task_id=$1 AND vr.status='fail'"
    ).bind(&id).fetch_one(&pool).await?;

    let avg_score: (Option<f64>,) = sqlx::query_as(
        "SELECT AVG(score) FROM assessment_results ar JOIN eval_runs er ON ar.eval_run_id=er.id WHERE er.task_id=$1"
    ).bind(&id).fetch_one(&pool).await?;

    let validation_total = validation_pass.0 + validation_fail.0;
    let validation_pass_rate: Option<f64> = if validation_total > 0 {
        Some(validation_pass.0 as f64 / validation_total as f64)
    } else {
        None
    };

    // By prompt grouping — use subqueries to avoid JOIN multiplication
    let by_prompt_rows = sqlx::query(
        "SELECT tp.id as tp_id, tp.label, tp.prompt_id,
            p.name as prompt_name, p.version as prompt_version,
            (SELECT COUNT(*) FROM eval_runs WHERE task_prompt_id = tp.id) as total,
            (SELECT COUNT(*) FROM eval_runs WHERE task_prompt_id = tp.id AND status='completed') as completed,
            (SELECT COUNT(*) FROM validation_results vr2
               JOIN eval_runs er2 ON vr2.eval_run_id = er2.id
               WHERE er2.task_prompt_id = tp.id AND vr2.status='pass') as pass_count,
            (SELECT COUNT(*) FROM validation_results vr3
               JOIN eval_runs er3 ON vr3.eval_run_id = er3.id
               WHERE er3.task_prompt_id = tp.id AND vr3.status IN ('pass', 'fail')) as validation_total,
            (SELECT AVG(ar.score) FROM assessment_results ar
               JOIN eval_runs er ON ar.eval_run_id = er.id
               WHERE er.task_prompt_id = tp.id) as avg_score
         FROM task_prompts tp
         LEFT JOIN prompts p ON p.id = tp.prompt_id
         WHERE tp.task_id = $1"
    ).bind(&id).fetch_all(&pool).await?;

    let by_prompt: Vec<Value> = by_prompt_rows.iter().map(|row| {
        use sqlx::Row;
        let total: i64 = row.try_get("total").unwrap_or(0);
        let completed: i64 = row.try_get("completed").unwrap_or(0);
        let pass_count: i64 = row.try_get("pass_count").unwrap_or(0);
        let validation_total: i64 = row.try_get("validation_total").unwrap_or(0);
        let avg_score: Option<f64> = row.try_get("avg_score").ok().flatten();
        let label: Option<String> = row.try_get("label").ok().flatten();
        let prompt_name: Option<String> = row.try_get("prompt_name").ok().flatten();
        let prompt_version: Option<String> = row.try_get("prompt_version").ok().flatten();
        let prompt_id: String = row.try_get("prompt_id").unwrap_or_default();
        // Only show pass_rate if validation has been run
        let pass_rate: Option<f64> = if validation_total > 0 {
            Some(pass_count as f64 / validation_total as f64)
        } else {
            None
        };
        let display_label = label.or_else(|| {
            match (prompt_name, prompt_version) {
                (Some(n), Some(v)) => Some(format!("{} ({})", n, v)),
                (Some(n), None) => Some(n),
                _ => None,
            }
        }).unwrap_or_else(|| prompt_id[..8].to_string());
        json!({
            "label": display_label,
            "prompt_id": prompt_id,
            "total": total,
            "completed": completed,
            "pass_count": pass_count,
            "pass_rate": pass_rate,
            "avg_score": avg_score
        })
    }).collect();

    // By model grouping — use subqueries to avoid JOIN multiplication
    let by_model_rows = sqlx::query(
        "SELECT tm.id as tm_id, tm.label, tm.model_config_id,
            mc.name as model_name,
            (SELECT COUNT(*) FROM eval_runs WHERE task_model_id = tm.id) as total,
            (SELECT COUNT(*) FROM eval_runs WHERE task_model_id = tm.id AND status='completed') as completed,
            (SELECT COUNT(*) FROM validation_results vr2
               JOIN eval_runs er2 ON vr2.eval_run_id = er2.id
               WHERE er2.task_model_id = tm.id AND vr2.status='pass') as pass_count,
            (SELECT COUNT(*) FROM validation_results vr3
               JOIN eval_runs er3 ON vr3.eval_run_id = er3.id
               WHERE er3.task_model_id = tm.id AND vr3.status IN ('pass', 'fail')) as validation_total,
            (SELECT AVG(ar.score) FROM assessment_results ar
               JOIN eval_runs er ON ar.eval_run_id = er.id
               WHERE er.task_model_id = tm.id) as avg_score
         FROM task_models tm
         LEFT JOIN model_configs mc ON mc.id = tm.model_config_id
         WHERE tm.task_id = $1"
    ).bind(&id).fetch_all(&pool).await?;

    let by_model: Vec<Value> = by_model_rows.iter().map(|row| {
        use sqlx::Row;
        let total: i64 = row.try_get("total").unwrap_or(0);
        let completed: i64 = row.try_get("completed").unwrap_or(0);
        let pass_count: i64 = row.try_get("pass_count").unwrap_or(0);
        let validation_total: i64 = row.try_get("validation_total").unwrap_or(0);
        let avg_score: Option<f64> = row.try_get("avg_score").ok().flatten();
        let label: Option<String> = row.try_get("label").ok().flatten();
        let model_name: Option<String> = row.try_get("model_name").ok().flatten();
        let model_id: String = row.try_get("model_config_id").unwrap_or_default();
        let pass_rate: Option<f64> = if validation_total > 0 {
            Some(pass_count as f64 / validation_total as f64)
        } else {
            None
        };
        let display_label = label.or(model_name).unwrap_or_else(|| model_id[..8].to_string());
        json!({
            "label": display_label,
            "model_id": model_id,
            "total": total,
            "completed": completed,
            "pass_count": pass_count,
            "pass_rate": pass_rate,
            "avg_score": avg_score
        })
    }).collect();

    // Per-checkpoint breakdown (only populated if validation has been run)
    let checkpoint_breakdown_rows = sqlx::query(
        "SELECT vc.id, vc.name, vc.criterion, vc.order_index,
            COALESCE((SELECT COUNT(*) FROM validation_results vr
               JOIN eval_runs er ON vr.eval_run_id = er.id
               WHERE er.task_id = $1 AND vr.checkpoint_id = vc.id AND vr.status = 'pass'), 0) as pass_count,
            COALESCE((SELECT COUNT(*) FROM validation_results vr
               JOIN eval_runs er ON vr.eval_run_id = er.id
               WHERE er.task_id = $1 AND vr.checkpoint_id = vc.id AND (vr.status = 'pass' OR vr.status = 'fail')), 0) as eval_count
         FROM validation_checkpoints vc
         WHERE vc.task_id = $1
         ORDER BY vc.order_index ASC"
    ).bind(&id).fetch_all(&pool).await.unwrap_or_default();

    let by_checkpoint: Vec<Value> = checkpoint_breakdown_rows.iter().map(|row| {
        use sqlx::Row;
        let name: String = row.try_get("name").unwrap_or_default();
        let criterion: String = row.try_get("criterion").unwrap_or_default();
        let pass_count: i64 = row.try_get("pass_count").unwrap_or(0);
        let eval_count: i64 = row.try_get("eval_count").unwrap_or(0);
        let pass_rate: Option<f64> = if eval_count > 0 {
            Some(pass_count as f64 / eval_count as f64)
        } else {
            None
        };
        json!({
            "name": name,
            "criterion": criterion,
            "pass_count": pass_count,
            "eval_count": eval_count,
            "pass_rate": pass_rate,
        })
    }).collect();

    // Checkpoint × Prompt pivot: for each (checkpoint, prompt version) pair, pass rate
    let cp_prompt_rows = sqlx::query(
        "SELECT vc.id as cp_id, vc.name as cp_name, vc.criterion, vc.order_index,
                tp.id as tp_id,
                COALESCE(tp.label, p.name || ' (' || p.version || ')') as group_label,
                COUNT(CASE WHEN vr.status = 'pass' THEN 1 END) as pass_count,
                COUNT(CASE WHEN vr.status IN ('pass', 'fail') THEN 1 END) as eval_count
         FROM validation_checkpoints vc
         CROSS JOIN task_prompts tp
         LEFT JOIN prompts p ON p.id = tp.prompt_id
         LEFT JOIN eval_runs er ON er.task_prompt_id = tp.id AND er.task_id = $1
         LEFT JOIN validation_results vr ON vr.eval_run_id = er.id AND vr.checkpoint_id = vc.id
         WHERE vc.task_id = $1 AND tp.task_id = $1
         GROUP BY vc.id, vc.name, vc.criterion, vc.order_index, tp.id, tp.label, p.name, p.version
         ORDER BY vc.order_index ASC, tp.id ASC"
    ).bind(&id).fetch_all(&pool).await.unwrap_or_default();

    let by_checkpoint_prompt: Vec<Value> = cp_prompt_rows.iter().map(|row| {
        use sqlx::Row;
        let cp_name: String = row.try_get("cp_name").unwrap_or_default();
        let criterion: String = row.try_get("criterion").unwrap_or_default();
        let order_index: i32 = row.try_get("order_index").unwrap_or(0);
        let group_label: String = row.try_get("group_label").unwrap_or_default();
        let pass_count: i64 = row.try_get("pass_count").unwrap_or(0);
        let eval_count: i64 = row.try_get("eval_count").unwrap_or(0);
        let pass_rate: Option<f64> = if eval_count > 0 { Some(pass_count as f64 / eval_count as f64) } else { None };
        json!({ "checkpoint_name": cp_name, "criterion": criterion, "order_index": order_index,
                "group_label": group_label, "pass_count": pass_count, "eval_count": eval_count, "pass_rate": pass_rate })
    }).collect();

    // Checkpoint × Model pivot
    let cp_model_rows = sqlx::query(
        "SELECT vc.id as cp_id, vc.name as cp_name, vc.criterion, vc.order_index,
                tm.id as tm_id,
                COALESCE(tm.label, mc.name) as group_label,
                COUNT(CASE WHEN vr.status = 'pass' THEN 1 END) as pass_count,
                COUNT(CASE WHEN vr.status IN ('pass', 'fail') THEN 1 END) as eval_count
         FROM validation_checkpoints vc
         CROSS JOIN task_models tm
         LEFT JOIN model_configs mc ON mc.id = tm.model_config_id
         LEFT JOIN eval_runs er ON er.task_model_id = tm.id AND er.task_id = $1
         LEFT JOIN validation_results vr ON vr.eval_run_id = er.id AND vr.checkpoint_id = vc.id
         WHERE vc.task_id = $1 AND tm.task_id = $1
         GROUP BY vc.id, vc.name, vc.criterion, vc.order_index, tm.id, tm.label, mc.name
         ORDER BY vc.order_index ASC, tm.id ASC"
    ).bind(&id).fetch_all(&pool).await.unwrap_or_default();

    let by_checkpoint_model: Vec<Value> = cp_model_rows.iter().map(|row| {
        use sqlx::Row;
        let cp_name: String = row.try_get("cp_name").unwrap_or_default();
        let criterion: String = row.try_get("criterion").unwrap_or_default();
        let order_index: i32 = row.try_get("order_index").unwrap_or(0);
        let group_label: String = row.try_get("group_label").unwrap_or_default();
        let pass_count: i64 = row.try_get("pass_count").unwrap_or(0);
        let eval_count: i64 = row.try_get("eval_count").unwrap_or(0);
        let pass_rate: Option<f64> = if eval_count > 0 { Some(pass_count as f64 / eval_count as f64) } else { None };
        json!({ "checkpoint_name": cp_name, "criterion": criterion, "order_index": order_index,
                "group_label": group_label, "pass_count": pass_count, "eval_count": eval_count, "pass_rate": pass_rate })
    }).collect();

    Ok(Json(json!({
        "success": true,
        "data": {
            "total_runs": total_runs.0,
            "completed_runs": completed_runs.0,
            "failed_runs": failed_runs.0,
            "avg_tokens": avg_tokens.0,
            "avg_duration_ms": avg_duration.0,
            "validation": {
                "pass": validation_pass.0,
                "fail": validation_fail.0
            },
            "validation_pass_rate": validation_pass_rate,
            "avg_assessment_score": avg_score.0,
            "by_prompt": by_prompt,
            "by_model": by_model,
            "by_checkpoint": by_checkpoint,
            "by_checkpoint_prompt": by_checkpoint_prompt,
            "by_checkpoint_model": by_checkpoint_model
        }
    })))
}

pub async fn get_task_progress(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    // Verify task exists
    let task_exists: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tasks WHERE id = $1")
        .bind(&id)
        .fetch_one(&pool)
        .await?;
    if task_exists.0 == 0 {
        return Err(AppError::NotFound(format!("任务 {} 不存在", id)));
    }

    // --- Inference progress ---
    let (total_runs, completed_runs, failed_runs): (i64, i64, i64) = {
        let r: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM eval_runs WHERE task_id=$1")
            .bind(&id).fetch_one(&pool).await?;
        let c: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM eval_runs WHERE task_id=$1 AND status='completed'")
            .bind(&id).fetch_one(&pool).await?;
        let f: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM eval_runs WHERE task_id=$1 AND status='failed'")
            .bind(&id).fetch_one(&pool).await?;
        (r.0, c.0, f.0)
    };

    // --- Validation progress ---
    let checkpoint_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM validation_checkpoints WHERE task_id=$1"
    ).bind(&id).fetch_one(&pool).await?;

    let validation_expected = completed_runs * checkpoint_count.0;

    let val_done: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM validation_results vr
         JOIN eval_runs er ON vr.eval_run_id = er.id
         WHERE er.task_id=$1 AND vr.status IN ('pass','fail','error')"
    ).bind(&id).fetch_one(&pool).await?;

    let val_pending: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM validation_results vr
         JOIN eval_runs er ON vr.eval_run_id = er.id
         WHERE er.task_id=$1 AND vr.status='pending'"
    ).bind(&id).fetch_one(&pool).await?;

    let val_pass: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM validation_results vr
         JOIN eval_runs er ON vr.eval_run_id = er.id
         WHERE er.task_id=$1 AND vr.status='pass'"
    ).bind(&id).fetch_one(&pool).await?;

    let val_fail: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM validation_results vr
         JOIN eval_runs er ON vr.eval_run_id = er.id
         WHERE er.task_id=$1 AND vr.status='fail'"
    ).bind(&id).fetch_one(&pool).await?;

    // --- Assessment progress (auto only) ---
    let assess_done: (i64,) = sqlx::query_as(
        "SELECT COUNT(DISTINCT ar.eval_run_id) FROM assessment_results ar
         JOIN eval_runs er ON ar.eval_run_id = er.id
         WHERE er.task_id=$1 AND ar.mode='auto'"
    ).bind(&id).fetch_one(&pool).await?;

    Ok(Json(json!({
        "success": true,
        "data": {
            "inference": {
                "total": total_runs,
                "completed": completed_runs,
                "failed": failed_runs
            },
            "validation": {
                "checkpoint_count": checkpoint_count.0,
                "expected": validation_expected,
                "done": val_done.0,
                "pending": val_pending.0,
                "pass": val_pass.0,
                "fail": val_fail.0
            },
            "assessment": {
                "expected": completed_runs,
                "done": assess_done.0
            }
        }
    })))
}

pub async fn get_results_details(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let runs = sqlx::query_as::<_, EvalRun>(
        "SELECT id, task_id, task_prompt_id, task_model_id, task_test_item_id, repeat_index, status, input_messages, output_content, error_message, tokens_used, duration_ms, created_at, completed_at FROM eval_runs WHERE task_id = $1 ORDER BY created_at ASC"
    )
    .bind(&id)
    .fetch_all(&pool)
    .await?;

    let mut details = Vec::new();
    for run in &runs {
        let validation_results = sqlx::query_as::<_, ValidationResult>(
            "SELECT id, eval_run_id, checkpoint_id, status, result, annotations, comment, created_at FROM validation_results WHERE eval_run_id = $1"
        )
        .bind(&run.id)
        .fetch_all(&pool)
        .await?;

        let assessment_results = sqlx::query_as::<_, AssessmentResult>(
            "SELECT id, eval_run_id, mode, score, comment, details, assessor, created_at FROM assessment_results WHERE eval_run_id = $1"
        )
        .bind(&run.id)
        .fetch_all(&pool)
        .await?;

        details.push(json!({
            "run": run,
            "validation_results": validation_results,
            "assessment_results": assessment_results
        }));
    }

    Ok(Json(json!({ "success": true, "data": details })))
}
