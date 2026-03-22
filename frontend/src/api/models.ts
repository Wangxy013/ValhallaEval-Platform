import client from './client'
import type { ModelConfig } from '../types'

export async function listModels(): Promise<ModelConfig[]> {
  const res = await client.get('/models')
  return res.data
}

export async function getModel(id: string): Promise<ModelConfig> {
  const res = await client.get(`/models/${id}`)
  return res.data
}

export async function createModel(data: Omit<ModelConfig, 'id' | 'created_at' | 'updated_at'>): Promise<ModelConfig> {
  const res = await client.post('/models', data)
  return res.data
}

export async function updateModel(id: string, data: Partial<Omit<ModelConfig, 'id' | 'created_at' | 'updated_at'>>): Promise<ModelConfig> {
  const res = await client.put(`/models/${id}`, data)
  return res.data
}

export async function deleteModel(id: string): Promise<void> {
  await client.delete(`/models/${id}`)
}
