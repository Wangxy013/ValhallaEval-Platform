import client from './client'
import type { Prompt } from '../types'

export async function listPrompts(): Promise<Prompt[]> {
  const res = await client.get('/prompts')
  return res.data
}

export async function getPrompt(id: string): Promise<Prompt> {
  const res = await client.get(`/prompts/${id}`)
  return res.data
}

export async function createPrompt(data: Omit<Prompt, 'id' | 'created_at' | 'updated_at'>): Promise<Prompt> {
  const res = await client.post('/prompts', data)
  return res.data
}

export async function updatePrompt(id: string, data: Partial<Omit<Prompt, 'id' | 'created_at' | 'updated_at'>>): Promise<Prompt> {
  const res = await client.put(`/prompts/${id}`, data)
  return res.data
}

export async function deletePrompt(id: string): Promise<void> {
  await client.delete(`/prompts/${id}`)
}
