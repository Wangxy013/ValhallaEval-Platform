CREATE TABLE model_configs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    api_key TEXT NOT NULL,
    api_url TEXT NOT NULL,
    model_id TEXT NOT NULL,
    extra_config TEXT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE TABLE prompts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    content TEXT NOT NULL,
    change_notes TEXT,
    parent_id TEXT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE TABLE test_datasets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE TABLE test_items (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL REFERENCES test_datasets(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    metadata TEXT,
    order_index BIGINT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL
);

CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    eval_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    dataset_id TEXT,
    validation_config TEXT,
    assessment_mode TEXT NOT NULL DEFAULT 'manual',
    assessment_config TEXT,
    repeat_count BIGINT NOT NULL DEFAULT 1,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    started_at BIGINT,
    completed_at BIGINT
);

CREATE TABLE task_prompts (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    prompt_id TEXT NOT NULL,
    label TEXT
);

CREATE TABLE task_models (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    model_config_id TEXT NOT NULL,
    label TEXT
);

CREATE TABLE task_test_items (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    test_item_id TEXT NOT NULL,
    order_index BIGINT NOT NULL DEFAULT 0,
    content_snapshot TEXT NOT NULL
);

CREATE TABLE eval_runs (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    task_prompt_id TEXT,
    task_model_id TEXT NOT NULL,
    task_test_item_id TEXT NOT NULL,
    repeat_index BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    input_messages TEXT NOT NULL,
    output_content TEXT,
    error_message TEXT,
    tokens_used BIGINT,
    duration_ms BIGINT,
    created_at BIGINT NOT NULL,
    completed_at BIGINT
);

CREATE TABLE validation_checkpoints (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    criterion TEXT NOT NULL,
    order_index BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE validation_results (
    id TEXT PRIMARY KEY,
    eval_run_id TEXT NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
    checkpoint_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    result TEXT,
    annotations TEXT,
    comment TEXT,
    created_at BIGINT NOT NULL
);

CREATE TABLE assessment_results (
    id TEXT PRIMARY KEY,
    eval_run_id TEXT NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
    mode TEXT NOT NULL,
    score DOUBLE PRECISION,
    comment TEXT,
    details TEXT,
    assessor TEXT,
    created_at BIGINT NOT NULL
);
