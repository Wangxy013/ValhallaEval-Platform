-- Mark one prompt as the comparison baseline in prompt_comparison tasks
ALTER TABLE task_prompts ADD COLUMN IF NOT EXISTS is_baseline BOOLEAN NOT NULL DEFAULT FALSE;
