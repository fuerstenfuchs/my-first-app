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

  const pendingCapture = {
    content,
    source_url: sourceUrl,
    title,
    timestamp: Date.now(),
  }

  chrome.storage.local.set({ pendingCapture }, () => {
    // openPopup() requires a user gesture — works when extension is pinned to toolbar
    chrome.action.openPopup().catch(() => {
      // Extension not visible in toolbar; capture is saved, user opens manually
    })
  })
})
