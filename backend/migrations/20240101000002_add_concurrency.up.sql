-- Add concurrency configuration to tasks
-- Controls max parallel LLM calls for inference, validation, and assessment phases
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS concurrency BIGINT NOT NULL DEFAULT 3;
