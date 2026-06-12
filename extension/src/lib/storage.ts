let memoryStore: Record<string, string> = {}

export const chromeStorageAdapter = {
  getItem: (key: string): string | null => {
    return memoryStore[key] ?? null
  },
  setItem: (key: string, value: string): void => {
    memoryStore[key] = value
    chrome.storage.local.set({ [key]: value })
  },
  removeItem: (key: string): void => {
    delete memoryStore[key]
    chrome.storage.local.remove(key)
  },
}

export async function initStorage(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (items) => {
      memoryStore = { ...(items as Record<string, string>) }
      resolve()
    })
  })
}
