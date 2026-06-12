const MENU_ID = 'promptdb-save'

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: 'In PromptDB speichern',
    contexts: ['all'],
  })
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return

  const content = info.selectionText ?? ''
  const sourceUrl = tab?.url ?? ''
  const tabTitle = tab?.title ?? ''
  // Prefer selected text for the title suggestion; fall back to tab title
  const title = content
    ? content.slice(0, 60).trimEnd()
    : tabTitle

  const newCapture = {
    content,
    source_url: sourceUrl,
    title,
    timestamp: Date.now(),
  }

  // If a pendingCapture already exists, store as conflict for popup to resolve
  chrome.storage.local.get('pendingCapture', (result) => {
    if (result.pendingCapture) {
      chrome.storage.local.set({ pendingCaptureConflict: newCapture }, () => {
        chrome.action.openPopup().catch(() => {})
      })
    } else {
      chrome.storage.local.set({ pendingCapture: newCapture }, () => {
        chrome.action.openPopup().catch(() => {})
      })
    }
  })
})
