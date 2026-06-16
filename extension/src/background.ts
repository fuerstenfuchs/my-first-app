const MENU_ID = 'promptdb-save'
const MENU_FASHION_ID = 'promptdb-fashion-save'
const MENU_LOCATION_ID = 'promptdb-location-save'

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: 'In PromptDB speichern',
    contexts: ['all'],
  })
  chrome.contextMenus.create({
    id: MENU_FASHION_ID,
    title: 'Als Fashion Asset speichern',
    contexts: ['image'],
  })
  chrome.contextMenus.create({
    id: MENU_LOCATION_ID,
    title: 'Als Location speichern',
    contexts: ['image'],
  })
})

// Open as a real window so it stays open when the user clicks back to the page
function openCaptureWindow() {
  chrome.windows.create({
    url: chrome.runtime.getURL('popup.html'),
    type: 'popup',
    width: 400,
    height: 620,
    focused: true,
  }).catch(() => {})
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_FASHION_ID) {
    const fashionCapture = {
      imageUrl: info.srcUrl ?? '',
      sourceUrl: tab?.url ?? '',
      sourceTitle: tab?.title ?? '',
      timestamp: Date.now(),
    }
    chrome.storage.local.set({ pendingFashionCapture: fashionCapture }, openCaptureWindow)
    return
  }

  if (info.menuItemId === MENU_LOCATION_ID) {
    const locationCapture = {
      imageUrl: info.srcUrl ?? '',
      sourceUrl: tab?.url ?? '',
      sourceTitle: tab?.title ?? '',
      timestamp: Date.now(),
    }
    chrome.storage.local.set({ pendingLocationCapture: locationCapture }, openCaptureWindow)
    return
  }

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
      chrome.storage.local.set({ pendingCaptureConflict: newCapture }, openCaptureWindow)
    } else {
      chrome.storage.local.set({ pendingCapture: newCapture }, openCaptureWindow)
    }
  })
})
