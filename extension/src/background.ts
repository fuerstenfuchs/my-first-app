const MENU_ID                  = 'promptdb-save'
const MENU_FASHION_ID          = 'promptdb-fashion-save'
const MENU_FASHION_ADD_ID      = 'promptdb-fashion-add-image'
const MENU_OUTFIT_ID           = 'promptdb-outfit-save'
const MENU_LOCATION_ID         = 'promptdb-location-save'
const MENU_LOCATION_ADD_ID     = 'promptdb-location-add-image'
const MENU_POSE_ID             = 'promptdb-pose-save'
const MENU_CHARACTER_ID        = 'promptdb-character-save'
const MENU_CHARACTER_ADD_ID    = 'promptdb-character-add-image'

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: MENU_ID,                title: 'In PromptDB speichern',              contexts: ['all'] })
  chrome.contextMenus.create({ id: MENU_FASHION_ID,        title: 'Als Fashion Asset speichern',        contexts: ['image'] })
  chrome.contextMenus.create({ id: MENU_FASHION_ADD_ID,    title: 'Zu Kleidungsstück hinzufügen',       contexts: ['image'] })
  chrome.contextMenus.create({ id: MENU_OUTFIT_ID,         title: 'Als Outfit speichern',               contexts: ['image'] })
  chrome.contextMenus.create({ id: MENU_LOCATION_ID,       title: 'Als Location speichern',             contexts: ['image'] })
  chrome.contextMenus.create({ id: MENU_LOCATION_ADD_ID,   title: 'Zu Location hinzufügen',             contexts: ['image'] })
  chrome.contextMenus.create({ id: MENU_POSE_ID,           title: 'Als Pose / Aktion speichern',        contexts: ['image'] })
  chrome.contextMenus.create({ id: MENU_CHARACTER_ID,      title: 'Als Charakter speichern',            contexts: ['image'] })
  chrome.contextMenus.create({ id: MENU_CHARACTER_ADD_ID,  title: 'Zu Charakter hinzufügen',            contexts: ['image'] })
})

function openCaptureWindow() {
  chrome.windows.create({
    url: chrome.runtime.getURL('popup.html'),
    type: 'popup',
    width: 400,
    height: 620,
    focused: true,
  }).catch(() => {})
}

// All pending-capture keys represent a single, mutually-exclusive in-progress capture.
// Starting a new capture clears every other one, so an abandoned flow (e.g. a half-collected
// Outfit) can never resurface later and hijack an unrelated new capture.
const ALL_CAPTURE_KEYS = [
  'pendingFashionCapture', 'pendingFashionImageAdd', 'pendingLocationImageAdd',
  'pendingLocationCapture', 'pendingPoseCapture', 'pendingCharacterCapture', 'pendingCharacterImageAdd',
  'pendingOutfitCapture',
]

function setExclusiveCapture(key: string, value: unknown, callback?: () => void) {
  const others = ALL_CAPTURE_KEYS.filter(k => k !== key)
  chrome.storage.local.remove(others, () => {
    chrome.storage.local.set({ [key]: value }, callback)
  })
}

chrome.contextMenus.onClicked.addListener((info, tab) => {

  if (info.menuItemId === MENU_FASHION_ID) {
    setExclusiveCapture('pendingFashionCapture', {
      imageUrl: info.srcUrl ?? '',
      sourceUrl: tab?.url ?? '',
      sourceTitle: tab?.title ?? '',
      timestamp: Date.now(),
    }, openCaptureWindow)
    return
  }

  if (info.menuItemId === MENU_FASHION_ADD_ID) {
    setExclusiveCapture('pendingFashionImageAdd', {
      imageUrl: info.srcUrl ?? '',
      sourceUrl: tab?.url ?? '',
      sourceTitle: tab?.title ?? '',
      timestamp: Date.now(),
    }, openCaptureWindow)
    return
  }

  if (info.menuItemId === MENU_OUTFIT_ID) {
    const newImage = {
      imageUrl: info.srcUrl ?? '',
      sourceUrl: tab?.url ?? '',
      sourceTitle: tab?.title ?? '',
    }
    // Append to existing collection if one is open; otherwise start fresh and open popup
    chrome.storage.local.get('pendingOutfitCapture', (result) => {
      const existing = result.pendingOutfitCapture as { images: typeof newImage[], timestamp: number } | undefined
      if (existing && existing.images.length > 0) {
        // Already collecting — add image silently (popup is already open and listens via onChanged)
        chrome.storage.local.set({
          pendingOutfitCapture: { images: [...existing.images, newImage], timestamp: existing.timestamp }
        })
      } else {
        // Start new outfit capture and open popup
        setExclusiveCapture('pendingOutfitCapture', { images: [newImage], timestamp: Date.now() }, openCaptureWindow)
      }
    })
    return
  }

  if (info.menuItemId === MENU_LOCATION_ID) {
    setExclusiveCapture('pendingLocationCapture', {
      imageUrl: info.srcUrl ?? '',
      sourceUrl: tab?.url ?? '',
      sourceTitle: tab?.title ?? '',
      timestamp: Date.now(),
    }, openCaptureWindow)
    return
  }

  if (info.menuItemId === MENU_LOCATION_ADD_ID) {
    setExclusiveCapture('pendingLocationImageAdd', {
      imageUrl: info.srcUrl ?? '',
      sourceUrl: tab?.url ?? '',
      sourceTitle: tab?.title ?? '',
      timestamp: Date.now(),
    }, openCaptureWindow)
    return
  }

  if (info.menuItemId === MENU_POSE_ID) {
    setExclusiveCapture('pendingPoseCapture', {
      imageUrl: info.srcUrl ?? '',
      sourceUrl: tab?.url ?? '',
      sourceTitle: tab?.title ?? '',
      timestamp: Date.now(),
    }, openCaptureWindow)
    return
  }

  if (info.menuItemId === MENU_CHARACTER_ID) {
    setExclusiveCapture('pendingCharacterCapture', {
      imageUrl: info.srcUrl ?? '',
      sourceUrl: tab?.url ?? '',
      sourceTitle: tab?.title ?? '',
      timestamp: Date.now(),
    }, openCaptureWindow)
    return
  }

  if (info.menuItemId === MENU_CHARACTER_ADD_ID) {
    setExclusiveCapture('pendingCharacterImageAdd', {
      imageUrl: info.srcUrl ?? '',
      sourceUrl: tab?.url ?? '',
      sourceTitle: tab?.title ?? '',
      timestamp: Date.now(),
    }, openCaptureWindow)
    return
  }

  if (info.menuItemId !== MENU_ID) return

  const content = info.selectionText ?? ''
  const sourceUrl = tab?.url ?? ''
  const tabTitle = tab?.title ?? ''
  const title = content ? content.slice(0, 60).trimEnd() : tabTitle

  const newCapture = { content, source_url: sourceUrl, title, timestamp: Date.now() }

  chrome.storage.local.get('pendingCapture', (result) => {
    if (result.pendingCapture) {
      chrome.storage.local.set({ pendingCaptureConflict: newCapture }, openCaptureWindow)
    } else {
      chrome.storage.local.set({ pendingCapture: newCapture }, openCaptureWindow)
    }
  })
})
