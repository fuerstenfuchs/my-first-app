import { describe, it, expect } from 'vitest'

// Pure tag-parsing logic mirrored from PromptModal.handleSave
function parseTags(tagsInput: string): string[] {
  return tagsInput.split(',').map(t => t.trim()).filter(Boolean)
}

describe('tag parsing (PromptModal)', () => {
  it('splits comma-separated tags and trims whitespace', () => {
    expect(parseTags('blog, schreiben, deutsch')).toEqual(['blog', 'schreiben', 'deutsch'])
  })

  it('handles tags with extra spaces around commas', () => {
    expect(parseTags('  tag1  ,  tag2  ,  tag3  ')).toEqual(['tag1', 'tag2', 'tag3'])
  })

  it('empty string returns empty array', () => {
    expect(parseTags('')).toEqual([])
  })

  it('whitespace-only string returns empty array', () => {
    expect(parseTags('   ')).toEqual([])
  })

  it('single tag without comma', () => {
    expect(parseTags('musik')).toEqual(['musik'])
  })

  it('trailing comma does not produce empty tag', () => {
    expect(parseTags('tag1, tag2,')).toEqual(['tag1', 'tag2'])
  })

  it('multiple commas in a row do not produce empty tags', () => {
    expect(parseTags('tag1,,tag2')).toEqual(['tag1', 'tag2'])
  })
})

// Validation logic mirrored from PromptModal.handleSave
function validatePromptInput(title: string, content: string): { title?: string; content?: string } {
  const errors: { title?: string; content?: string } = {}
  if (!title.trim()) errors.title = 'Titel ist erforderlich'
  if (!content.trim()) errors.content = 'Prompt-Text ist erforderlich'
  return errors
}

describe('prompt form validation (PromptModal)', () => {
  it('no errors when both fields filled', () => {
    expect(validatePromptInput('My Title', 'My content')).toEqual({})
  })

  it('error when title is empty', () => {
    const result = validatePromptInput('', 'content')
    expect(result.title).toBeTruthy()
    expect(result.content).toBeUndefined()
  })

  it('error when content is empty', () => {
    const result = validatePromptInput('title', '')
    expect(result.content).toBeTruthy()
    expect(result.title).toBeUndefined()
  })

  it('error when both fields are empty', () => {
    const result = validatePromptInput('', '')
    expect(result.title).toBeTruthy()
    expect(result.content).toBeTruthy()
  })

  it('whitespace-only title counts as empty', () => {
    const result = validatePromptInput('   ', 'content')
    expect(result.title).toBeTruthy()
  })

  it('whitespace-only content counts as empty', () => {
    const result = validatePromptInput('title', '   ')
    expect(result.content).toBeTruthy()
  })
})
