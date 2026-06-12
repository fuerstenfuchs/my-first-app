import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock chrome API before importing background.ts
const mockSet = vi.fn((_data: object, cb?: () => void) => cb?.())
const mockOpenPopup = vi.fn(() => Promise.resolve())
const onInstalledCallback: Array<() => void> = []
const onClickedCallback: Array<(info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => void> = []

vi.stubGlobal('chrome', {
  runtime: {
    onInstalled: {
      addListener: (cb: () => void) => onInstalledCallback.push(cb),
    },
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
    },
  },
  action: {
    openPopup: mockOpenPopup,
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
    mockOpenPopup.mockClear()
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

  it('opens popup after storing capture', () => {
    fireClick({ selectionText: 'test' }, { url: 'https://x.com', title: 'X' })
    expect(mockOpenPopup).toHaveBeenCalledOnce()
  })
})
