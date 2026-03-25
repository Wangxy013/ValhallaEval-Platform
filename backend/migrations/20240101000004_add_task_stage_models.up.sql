ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS validation_model_id TEXT,
    ADD COLUMN IF NOT EXISTS assessment_model_id TEXT;
