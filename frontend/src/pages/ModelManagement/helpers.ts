export function maskApiKey(apiKey: string): string {
  if (!apiKey) return ''
  if (apiKey.length <= 8) return `${apiKey.slice(0, 2)}****${apiKey.slice(-2)}`
  return `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`
}

export interface ModelFormValues {
  name: string
  provider: string
  api_url: string
  api_key: string
  model_id: string
}

export function buildModelPayload(values: ModelFormValues, isEditing: boolean): Partial<ModelFormValues> {
  const payload: Partial<ModelFormValues> = {
    name: values.name.trim(),
    provider: values.provider,
    api_url: values.api_url.trim(),
    model_id: values.model_id.trim(),
  }

  const apiKey = values.api_key.trim()
  if (!isEditing || apiKey) {
    payload.api_key = apiKey
  }

  return payload
}
