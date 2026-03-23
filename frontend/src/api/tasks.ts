import client from './client'
import type { Task, EvalRun, TaskResultsOverview, ValidationCheckpoint, TaskProgress } from '../types'

export interface CreateTaskPayload {
  name: string;
  description?: string;
  eval_type: string;
  dataset_id?: string;
  model_config_ids: string[];
  prompt_ids: string[];
  test_item_ids?: string[];
  repeat_count: number;
  concurrency?: number;
  assessment_mode: string;
  assessment_config?: Record<string, unknown>;
  validation_checkpoints?: Array<{ name: string; criterion: string }>;
}

export async function listTasks(): Promise<Task[]> {
  const res = await client.get('/tasks')
  return res.data
}

export async function getTask(id: string): Promise<Task> {
  const res = await client.get(`/tasks/${id}`)
  // Backend returns { task, prompts, models, test_items }
  const d = res.data
  if (d && d.task) {
    return { ...d.task, prompts: d.prompts, models: d.models, test_items: d.test_items }
  }
  return d
}

export async function createTask(data: CreateTaskPayload): Promise<Task> {
  const res = await client.post('/tasks', data)
  const d = res.data
  if (d && d.task) {
    return { ...d.task, prompts: d.prompts, models: d.models, test_items: d.test_items }
  }
  return d
}

export async function updateTask(id: string, data: Partial<CreateTaskPayload>): Promise<Task> {
  const res = await client.put(`/tasks/${id}`, data)
  const d = res.data
  if (d && d.task) {
    return { ...d.task, prompts: d.prompts, models: d.models, test_items: d.test_items }
  }
  return d
}

export async function deleteTask(id: string): Promise<void> {
  await client.delete(`/tasks/${id}`)
}

export async function executeTask(id: string): Promise<void> {
  await client.post(`/tasks/${id}/execute`)
}

export async function pauseTask(id: string): Promise<void> {
  await client.post(`/tasks/${id}/pause`)
}

export async function resumeTask(id: string): Promise<void> {
  await client.post(`/tasks/${id}/resume`)
}

export async function getTaskResults(id: string): Promise<TaskResultsOverview> {
  const res = await client.get(`/tasks/${id}/results/overview`)
  return res.data
}

export async function listEvalRuns(taskId: string, params?: { prompt_id?: string; model_id?: string }): Promise<EvalRun[]> {
  const res = await client.get(`/tasks/${taskId}/runs`, { params })
  return res.data
}

export async function getEvalRun(taskId: string, runId: string): Promise<EvalRun> {
  const res = await client.get(`/tasks/${taskId}/runs/${runId}`)
  return res.data
}

export async function validateRuns(taskId: string): Promise<void> {
  await client.post(`/tasks/${taskId}/validate`)
}

export async function autoAssessRuns(taskId: string): Promise<void> {
  await client.post(`/tasks/${taskId}/assess`)
}

export async function listCheckpoints(taskId: string): Promise<ValidationCheckpoint[]> {
  const res = await client.get(`/tasks/${taskId}/checkpoints`)
  return res.data
}

export async function getTaskProgress(taskId: string): Promise<TaskProgress> {
  const res = await client.get(`/tasks/${taskId}/progress`)
  return res.data
}

export async function submitManualAssessment(
  taskId: string,
  runId: string,
  data: { score?: number; comment?: string }
): Promise<void> {
  await client.post(`/tasks/${taskId}/runs/${runId}/assess`, data)
}
