export type ProviderType =
  | 'doubao' | 'spark' | 'qwen' | 'ernie' | 'zhipu'
  | 'kimi' | 'hunyuan' | 'deepseek' | 'yi'
  | 'openai' | 'openai_compatible' | string

export interface ModelConfig {
  id: string;
  name: string;
  provider: ProviderType;
  api_key: string;
  api_url: string;
  model_id: string;
  extra_config?: Record<string, unknown>;
  created_at: number;
  updated_at: number;
}

export interface Prompt {
  id: string;
  name: string;
  version: string;
  content: string;
  change_notes?: string;
  parent_id?: string;
  created_at: number;
  updated_at: number;
}

export interface TestDataset {
  id: string;
  name: string;
  description?: string;
  items?: TestItem[];
  created_at: number;
  updated_at: number;
}

export interface TestItem {
  id: string;
  dataset_id: string;
  content: string;
  metadata?: Record<string, unknown>;
  order_index: number;
  created_at: number;
}

export type TaskStatus = 'draft' | 'running' | 'paused' | 'completed' | 'failed';
export type EvalType = 'prompt_comparison' | 'model_comparison';
export type AssessmentMode = 'manual' | 'auto' | 'custom';

export interface Task {
  id: string;
  name: string;
  description?: string;
  eval_type: EvalType;
  status: TaskStatus;
  dataset_id?: string;
  validation_config?: ValidationConfig;
  assessment_mode: AssessmentMode;
  assessment_config?: Record<string, unknown>;
  repeat_count: number;
  concurrency: number;
  prompts?: TaskPrompt[];
  models?: TaskModel[];
  test_items?: TaskTestItem[];
  created_at: number;
  updated_at: number;
  started_at?: number;
  completed_at?: number;
}

export interface ValidationConfig {
  checkpoints: ValidationCheckpoint[];
}

export interface TaskPrompt {
  id: string;
  task_id: string;
  prompt_id: string;
  label?: string;
  is_baseline?: boolean;
  prompt?: Prompt;
}

export interface TaskModel {
  id: string;
  task_id: string;
  model_config_id: string;
  label?: string;
  model?: ModelConfig;
}

export interface TaskTestItem {
  id: string;
  task_id: string;
  test_item_id: string;
  order_index: number;
  content_snapshot: string;
}

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface InputMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface EvalRun {
  id: string;
  task_id: string;
  task_prompt_id?: string;
  task_model_id: string;
  task_test_item_id: string;
  repeat_index: number;
  status: RunStatus;
  input_messages: InputMessage[];
  output_content?: string;
  error_message?: string;
  tokens_used?: number;
  duration_ms?: number;
  created_at: number;
  completed_at?: number;
  // enriched fields
  prompt?: Prompt;
  model?: ModelConfig;
  prompt_label?: string;
  prompt_is_baseline?: boolean;
  model_label?: string;
  test_item_content?: string;
  validation_results?: ValidationResult[];
  assessment_results?: AssessmentResult[];
}

export interface ValidationCheckpoint {
  id: string;
  task_id: string;
  name: string;
  criterion: string;
  order_index: number;
}

export interface Annotation {
  text: string;
  type: 'pass' | 'fail' | 'partial';
  comment: string;
}

export interface ValidationResult {
  id: string;
  eval_run_id: string;
  checkpoint_id: string;
  checkpoint_name?: string;
  checkpoint_criterion?: string;
  status: string;
  result?: 'pass' | 'fail' | 'partial';
  annotations?: Annotation[];
  comment?: string;
  created_at: number;
}

export interface AssessmentResult {
  id: string;
  eval_run_id: string;
  mode: AssessmentMode;
  score?: number;
  comment?: string;
  details?: Record<string, unknown>;
  assessor?: string;
  created_at: number;
}

export interface CheckpointBreakdown {
  name: string;
  criterion: string;
  pass_count: number;
  eval_count: number;
  pass_rate?: number;
}

export interface CheckpointGroupStat {
  checkpoint_name: string;
  criterion: string;
  order_index: number;
  group_label: string;
  is_baseline?: boolean;
  pass_count: number;
  eval_count: number;
  pass_rate?: number;
}

export interface TaskResultsOverview {
  total_runs: number;
  completed_runs: number;
  failed_runs: number;
  avg_tokens?: number;
  avg_duration_ms?: number;
  validation: { pass: number; fail: number };
  validation_pass_rate?: number;
  avg_assessment_score?: number;
  by_prompt: GroupedResult[];
  by_model: GroupedResult[];
  by_checkpoint: CheckpointBreakdown[];
  by_checkpoint_prompt: CheckpointGroupStat[];
  by_checkpoint_model: CheckpointGroupStat[];
}

export interface TaskProgress {
  inference: {
    total: number;
    completed: number;
    failed: number;
  };
  validation: {
    checkpoint_count: number;
    expected: number;
    done: number;
    pending: number;
    pass: number;
    fail: number;
  };
  assessment: {
    expected: number;
    done: number;
  };
}

export interface GroupedResult {
  label: string;
  prompt_id?: string;
  model_id?: string;
  is_baseline?: boolean;
  total: number;
  completed: number;
  pass_count: number;
  pass_rate: number;
  avg_score?: number;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}
