import { StateCreator } from 'zustand'
import { storageService } from '../../lib/storage'

export interface ThemeSlice {
  // Theme state
  theme: string
  tagColors: Record<string, string>

  // Theme actions
  setTheme: (theme: string) => void
  setTagColor: (tag: string, color: string) => void
  getTagColor: (tag: string) => string
  resetTagColors: () => void
  loadTagColors: () => Promise<void>
}

// Predefined tag color mappings
const predefinedTagColors = {
  'project': 'ocean',
  'work': 'steel',
  'personal': 'forest',
  'urgent': 'cherry',
  'important': 'sunset',
  'idea': 'golden',
  'note': 'sage',
  'todo': 'royal',
  'meeting': 'turquoise',
  'draft': 'lavender'
} as const

// Available color options for automatic assignment
const colorOptions = [
  'ocean', 'forest', 'royal', 'sunset', 'cherry', 'golden', 
  'lavender', 'turquoise', 'rose', 'sage', 'steel', 'copper'
] as const

// Hash function for consistent color assignment
const hashTagToColor = (tag: string): string => {
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colorIndex = Math.abs(hash) % colorOptions.length
  return colorOptions[colorIndex]
}

export const createThemeSlice: StateCreator<ThemeSlice, [], [], ThemeSlice> = (set, get) => ({
  // Initial state
  theme: 'dark',
  tagColors: storageService.getTagColors(),

  // Actions
  setTheme: (theme) => set({ theme }),

  setTagColor: (tag, color) => {
    console.log('🎨 setTagColor called:', { tag, color })
    set((state) => {
      console.log('🎨 Current tagColors state:', state.tagColors)
      const newTagColors = { ...state.tagColors, [tag]: color }
      console.log('🎨 New tagColors to save:', newTagColors)
      // Persist to localStorage
      console.log('🎨 Calling storageService.saveTagColors...')
      storageService.saveTagColors(newTagColors)
      console.log('🎨 saveTagColors completed')
      return { tagColors: newTagColors }
    })
  },

  getTagColor: (tag) => {
    const state = get()
    
    // Return stored color if available
    if (state.tagColors[tag]) {
      return state.tagColors[tag]
    }
    
    // Check predefined colors
    const lowerTag = tag.toLowerCase()
    if (predefinedTagColors[lowerTag as keyof typeof predefinedTagColors]) {
      return predefinedTagColors[lowerTag as keyof typeof predefinedTagColors]
    }
    
    // Generate color based on tag hash for consistency
    return hashTagToColor(tag)
  },

  resetTagColors: () => {
    set({ tagColors: {} })
    storageService.saveTagColors({})
  },

  loadTagColors: async () => {
    try {
      console.log('🔄 loadTagColors: Starting async load...')
      const loadedTagColors = await storageService.loadTagColors()
      console.log('🔄 loadTagColors: Loaded from storage:', JSON.stringify(loadedTagColors, null, 2))
      set({ tagColors: loadedTagColors })
      console.log('🔄 loadTagColors: State updated with:', JSON.stringify(loadedTagColors, null, 2))
    } catch (error) {
      console.error('Failed to load tag colors:', error)
    }
  }
})