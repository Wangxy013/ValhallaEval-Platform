import client from './client'
import type { TestDataset, TestItem } from '../types'

export async function listDatasets(): Promise<TestDataset[]> {
  const res = await client.get('/datasets')
  return res.data
}

export async function getDataset(id: string): Promise<TestDataset> {
  const res = await client.get(`/datasets/${id}`)
  // Backend returns { dataset: {...}, items: [...] }
  const d = res.data
  if (d && d.dataset) {
    return { ...d.dataset, items: d.items }
  }
  return d
}

export async function createDataset(data: Omit<TestDataset, 'id' | 'created_at' | 'updated_at' | 'items'>): Promise<TestDataset> {
  const res = await client.post('/datasets', data)
  return res.data
}

export async function updateDataset(id: string, data: Partial<Omit<TestDataset, 'id' | 'created_at' | 'updated_at' | 'items'>>): Promise<TestDataset> {
  const res = await client.put(`/datasets/${id}`, data)
  return res.data
}

export async function deleteDataset(id: string): Promise<void> {
  await client.delete(`/datasets/${id}`)
}

export async function listTestItems(datasetId: string): Promise<TestItem[]> {
  const res = await client.get(`/datasets/${datasetId}/items`)
  return res.data
}

export async function createTestItem(datasetId: string, data: { content: string; metadata?: Record<string, unknown> }): Promise<TestItem> {
  const res = await client.post(`/datasets/${datasetId}/items`, data)
  return res.data
}

export async function createTestItemsBatch(datasetId: string, contents: string[]): Promise<TestItem[]> {
  const res = await client.post(`/datasets/${datasetId}/items/batch`, { contents })
  return res.data
}

export async function deleteTestItem(datasetId: string, itemId: string): Promise<void> {
  await client.delete(`/datasets/${datasetId}/items/${itemId}`)
}
