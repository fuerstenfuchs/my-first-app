import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock chrome API before importing background.ts
const mockSet = vi.fn((_data: object, cb?: () => void) => cb?.())
const mockGet = vi.fn((_key: string, cb: (result: Record<string, unknown>) => void) => cb({}))
const mockWindowsCreate = vi.fn(() => Promise.resolve({ id: 42 }))
const onInstalledCallback: Array<() => void> = []
const onClickedCallback: Array<(info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => void> = []

vi.stubGlobal('chrome', {
  runtime: {
    onInstalled: {
      addListener: (cb: () => void) => onInstalledCallback.push(cb),
    },
    getURL: (path: string) => `chrome-extension://testid/${path}`,
  },
  contextMenus: {
    create: vi.fn(),
    onClicked: {
      addListener: (cb: (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => void) =>
        onClickedCallback.push(cb),
    },
  },
  storage: {
    local: {
      set: mockSet,
      get: mockGet,
    },
  },
  windows: {
    create: mockWindowsCreate,
  },
})

// Import after mocking chrome
await import('./background')

function fireClick(info: Partial<chrome.contextMenus.OnClickData>, tab?: Partial<chrome.tabs.Tab>) {
  const fullInfo = { menuItemId: 'promptdb-save', ...info } as chrome.contextMenus.OnClickData
  onClickedCallback.forEach(cb => cb(fullInfo, tab as chrome.tabs.Tab))
}

describe('background service worker', () => {
  beforeEach(() => {
    mockSet.mockClear()
    mockGet.mockClear()
    mockWindowsCreate.mockClear()
    // Default: no existing pendingCapture
    mockGet.mockImplementation((_key: string, cb: (r: Record<string, unknown>) => void) => cb({}))
  })

  it('registers context menu on install', () => {
    onInstalledCallback.forEach(cb => cb())
    expect(chrome.contextMenus.create).toHaveBeenCalledWith({
      id: 'promptdb-save',
      title: 'In PromptDB speichern',
      contexts: ['all'],
    })
  })

  it('stores pendingCapture with selected text and page URL', () => {
    fireClick(
      { selectionText: 'Hello world prompt' },
      { url: 'https://example.com/page', title: 'Example Page' },
    )
    expect(mockSet).toHaveBeenCalledOnce()
    const [payload] = mockSet.mock.calls[0]
    expect(payload.pendingCapture.content).toBe('Hello world prompt')
    expect(payload.pendingCapture.source_url).toBe('https://example.com/page')
    expect(payload.pendingCapture.title).toBe('Hello world prompt')
    expect(typeof payload.pendingCapture.timestamp).toBe('number')
  })

  it('uses tab title as title suggestion when no text selected', () => {
    fireClick(
      { selectionText: undefined },
      { url: 'https://example.com', title: 'My Tab Title' },
    )
    const [payload] = mockSet.mock.calls[0]
    expect(payload.pendingCapture.content).toBe('')
    expect(payload.pendingCapture.title).toBe('My Tab Title')
    expect(payload.pendingCapture.source_url).toBe('https://example.com')
  })

  it('truncates long selected text to 60 characters for title', () => {
    const longText = 'A'.repeat(80)
    fireClick({ selectionText: longText }, { url: 'https://x.com', title: 'X' })
    const [payload] = mockSet.mock.calls[0]
    expect(payload.pendingCapture.title.length).toBeLessThanOrEqual(60)
    expect(payload.pendingCapture.content).toBe(longText)
  })

  it('ignores clicks on other menu items', () => {
    fireClick({ menuItemId: 'some-other-menu' })
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('handles missing tab gracefully (url and title default to empty string)', () => {
    fireClick({ selectionText: 'test' }, undefined)
    const [payload] = mockSet.mock.calls[0]
    expect(payload.pendingCapture.source_url).toBe('')
  })

  it('opens capture window after storing capture', () => {
    fireClick({ selectionText: 'test' }, { url: 'https://x.com', title: 'X' })
    expect(mockWindowsCreate).toHaveBeenCalledOnce()
    expect(mockWindowsCreate).toHaveBeenCalledWith(expect.objectContaining({
      url: expect.stringContaining('popup.html'),
      type: 'popup',
    }))
  })

  it('stores new capture as pendingCaptureConflict when pendingCapture already exists', () => {
    const existing = { content: 'old', source_url: 'https://old.com', title: 'Old', timestamp: 1 }
    mockGet.mockImplementation((_key: string, cb: (r: Record<string, unknown>) => void) =>
      cb({ pendingCapture: existing })
    )
    fireClick({ selectionText: 'new capture' }, { url: 'https://new.com', title: 'New' })
    expect(mockSet).toHaveBeenCalledOnce()
    const [payload] = mockSet.mock.calls[0]
    expect(payload.pendingCaptureConflict).toBeDefined()
    expect(payload.pendingCaptureConflict.content).toBe('new capture')
    expect(payload.pendingCapture).toBeUndefined()
  })

  it('does not overwrite existing pendingCapture directly on conflict', () => {
    const existing = { content: 'old', source_url: 'https://old.com', title: 'Old', timestamp: 1 }
    mockGet.mockImplementation((_key: string, cb: (r: Record<string, unknown>) => void) =>
      cb({ pendingCapture: existing })
    )
    fireClick({ selectionText: 'new' }, { url: 'https://new.com', title: 'New' })
    const [payload] = mockSet.mock.calls[0]
    // pendingCapture should NOT be in the set payload — only conflict
    expect(payload.pendingCapture).toBeUndefined()
  })
})
