/**
 * Electron File System Storage Service
 * Replaces localStorage with secure file system storage via Electron APIs
 * Implements Inkdrop-style individual JSON files with automatic backup
 */

import { Note, Notebook, Settings } from '../types'
import { storageLogger as logger } from '../utils/logger'

interface ElectronAPI {
  storage: {
    saveNote: (note: Note) => Promise<{ success: boolean; path?: string }>
    loadNote: (id: string) => Promise<Note | null>
    loadAllNotes: () => Promise<Note[]>
    deleteNote: (id: string) => Promise<{ success: boolean; backupPath?: string }>
    saveNotebooks: (notebooks: Notebook[]) => Promise<{ success: boolean }>
    loadNotebooks: () => Promise<Notebook[]>
    saveSettings: (settings: Partial<Settings>) => Promise<{ success: boolean }>
    loadSettings: () => Promise<Partial<Settings>>
    saveTagColors: (tagColors: Record<string, string>) => Promise<{ success: boolean }>
    loadTagColors: () => Promise<Record<string, string>>
    migrateFromLocalStorage: (data: any) => Promise<{ success: boolean; message: string }>
    getStorageInfo: () => Promise<{
      dataDirectory: string
      notesCount: number
      notebooksCount: number
      hasSettings: boolean
      tagColorsCount: number
      directories: {
        data: string
        notes: string
        backups: string
      }
    }>
    getDataDirectory: () => Promise<string>
  }
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

class ElectronStorageService {
  private readonly LEGACY_NOTES_KEY = 'nototo_notes'
  private readonly LEGACY_NOTEBOOKS_KEY = 'nototo_notebooks'
  private readonly LEGACY_SETTINGS_KEY = 'nototo_settings'
  private readonly LEGACY_TAG_COLORS_KEY = 'nototo_tag_colors'
  
  private isElectron: boolean
  private migrationCompleted: boolean = false
  
  constructor() {
    this.isElectron = typeof window !== 'undefined' && !!window.electronAPI
    if (this.isElectron) {
      logger.info('[ElectronStorage] Initialized with Electron file system storage')
      this.checkAndMigrateLegacyData()
    } else {
      logger.warn('[ElectronStorage] Electron APIs not available, falling back to localStorage')
    }
  }

  // Check if we need to migrate from localStorage to file system
  private async checkAndMigrateLegacyData(): Promise<void> {
    try {
      if (!this.isElectron || this.migrationCompleted) return

      const hasLegacyData = (
        localStorage.getItem(this.LEGACY_NOTES_KEY) ||
        localStorage.getItem(this.LEGACY_NOTEBOOKS_KEY) ||
        localStorage.getItem(this.LEGACY_SETTINGS_KEY) ||
        localStorage.getItem(this.LEGACY_TAG_COLORS_KEY)
      )

      if (hasLegacyData) {
        logger.info('[ElectronStorage] Legacy localStorage data found, starting migration...')
        console.log('🔧 Migration: Before migration, localStorage contents:')
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key) {
            console.log(`🔧   ${key}: ${localStorage.getItem(key)?.substring(0, 100)}...`)
          }
        }
        await this.migrateLegacyData()
      }
    } catch (error) {
      logger.error('[ElectronStorage] Migration check failed:', error)
    }
  }

  // Migrate data from localStorage to file system
  private async migrateLegacyData(): Promise<void> {
    try {
      const legacyData = {
        notes: this.getLegacyNotes(),
        notebooks: this.getLegacyNotebooks(),
        settings: this.getLegacySettings(),
        tagColors: this.getLegacyTagColors()
      }

      if (this.isElectron) {
        const result = await window.electronAPI!.storage.migrateFromLocalStorage(legacyData)
        
        if (result.success) {
          logger.info('[ElectronStorage] Migration completed successfully:', result.message)
          
          // Clear legacy data after successful migration
          localStorage.removeItem(this.LEGACY_NOTES_KEY)
          localStorage.removeItem(this.LEGACY_NOTEBOOKS_KEY)
          localStorage.removeItem(this.LEGACY_SETTINGS_KEY)
          localStorage.removeItem(this.LEGACY_TAG_COLORS_KEY)
          
          console.log('🔧 Migration: After migration, localStorage contents:')
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key) {
              console.log(`🔧   ${key}: ${localStorage.getItem(key)?.substring(0, 100)}...`)
            }
          }
          
          this.migrationCompleted = true
        } else {
          throw new Error('Migration failed')
        }
      }
    } catch (error) {
      logger.error('[ElectronStorage] Migration failed:', error)
      throw new Error(`Failed to migrate legacy data: ${error.message}`)
    }
  }

  // Legacy data getters for migration
  private getLegacyNotes(): Note[] {
    try {
      const stored = localStorage.getItem(this.LEGACY_NOTES_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  private getLegacyNotebooks(): Notebook[] {
    try {
      const stored = localStorage.getItem(this.LEGACY_NOTEBOOKS_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  private getLegacySettings(): Partial<Settings> {
    try {
      const stored = localStorage.getItem(this.LEGACY_SETTINGS_KEY)
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  }

  private getLegacyTagColors(): Record<string, string> {
    try {
      const stored = localStorage.getItem(this.LEGACY_TAG_COLORS_KEY)
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  }

  // Public method to access tag colors synchronously (for fallback)
  getTagColorsSync(): Record<string, string> {
    // First try the current/persistent key (not affected by migration)
    const currentKey = 'nototo_tag_colors_current'
    console.log('🔍 getTagColorsSync: Checking localStorage key:', currentKey)
    const currentData = localStorage.getItem(currentKey)
    console.log('🔍 getTagColorsSync: Raw localStorage data from current key:', currentData)
    
    if (currentData) {
      try {
        const parsed = JSON.parse(currentData)
        console.log('🔍 getTagColorsSync: Parsed result from current key:', JSON.stringify(parsed, null, 2))
        return parsed
      } catch (error) {
        console.error('🔍 getTagColorsSync: Error parsing current data:', error)
      }
    }
    
    // Fallback to legacy key (will be empty after migration)
    console.log('🔍 getTagColorsSync: Falling back to legacy key:', this.LEGACY_TAG_COLORS_KEY)
    const legacyData = localStorage.getItem(this.LEGACY_TAG_COLORS_KEY)
    console.log('🔍 getTagColorsSync: Raw localStorage data from legacy key:', legacyData)
    const result = this.getLegacyTagColors()
    console.log('🔍 getTagColorsSync: Parsed result from legacy key:', JSON.stringify(result, null, 2))
    return result
  }

  // Notes operations
  async getNotes(): Promise<Note[]> {
    if (this.isElectron) {
      try {
        return await window.electronAPI!.storage.loadAllNotes()
      } catch (error) {
        logger.error('[ElectronStorage] Failed to load notes:', error)
        throw error
      }
    } else {
      // Fallback to localStorage
      return this.getLegacyNotes()
    }
  }

  async saveNotes(notes: Note[]): Promise<void> {
    if (this.isElectron) {
      // In Electron, we save notes individually for better performance and backup
      logger.info('[ElectronStorage] Saving', notes.length, 'notes individually')
      
      try {
        const savePromises = notes.map(note => this.saveNote(note))
        await Promise.all(savePromises)
        logger.info('[ElectronStorage] All notes saved successfully')
      } catch (error) {
        logger.error('[ElectronStorage] Failed to save notes:', error)
        throw error
      }
    } else {
      // Fallback to localStorage
      localStorage.setItem(this.LEGACY_NOTES_KEY, JSON.stringify(notes))
    }
  }

  async saveNote(note: Note): Promise<void> {
    if (!note || !note.id) {
      throw new Error('Invalid note: missing id')
    }

    if (this.isElectron) {
      try {
        const result = await window.electronAPI!.storage.saveNote(note)
        if (!result.success) {
          throw new Error('Failed to save note to file system')
        }
        logger.debug('[ElectronStorage] Note saved:', note.id)
      } catch (error) {
        logger.error('[ElectronStorage] Failed to save note:', error)
        throw error
      }
    } else {
      // Fallback: update localStorage notes array
      const notes = this.getLegacyNotes()
      const existingIndex = notes.findIndex(n => n.id === note.id)
      
      if (existingIndex >= 0) {
        notes[existingIndex] = note
      } else {
        notes.push(note)
      }
      
      localStorage.setItem(this.LEGACY_NOTES_KEY, JSON.stringify(notes))
    }
  }

  async loadNote(id: string): Promise<Note | null> {
    if (this.isElectron) {
      try {
        return await window.electronAPI!.storage.loadNote(id)
      } catch (error) {
        logger.error('[ElectronStorage] Failed to load note:', error)
        return null
      }
    } else {
      // Fallback to localStorage
      const notes = this.getLegacyNotes()
      return notes.find(n => n.id === id) || null
    }
  }

  async deleteNote(noteId: string): Promise<void> {
    if (this.isElectron) {
      try {
        const result = await window.electronAPI!.storage.deleteNote(noteId)
        if (!result.success) {
          throw new Error('Failed to delete note from file system')
        }
        logger.info('[ElectronStorage] Note deleted:', noteId)
      } catch (error) {
        logger.error('[ElectronStorage] Failed to delete note:', error)
        throw error
      }
    } else {
      // Fallback to localStorage
      const notes = this.getLegacyNotes().filter(note => note.id !== noteId)
      localStorage.setItem(this.LEGACY_NOTES_KEY, JSON.stringify(notes))
    }
  }

  // Notebooks operations
  async getNotebooks(): Promise<Notebook[]> {
    if (this.isElectron) {
      try {
        return await window.electronAPI!.storage.loadNotebooks()
      } catch (error) {
        logger.error('[ElectronStorage] Failed to load notebooks:', error)
        return []
      }
    } else {
      return this.getLegacyNotebooks()
    }
  }

  async saveNotebooks(notebooks: Notebook[]): Promise<void> {
    if (this.isElectron) {
      try {
        const result = await window.electronAPI!.storage.saveNotebooks(notebooks)
        if (!result.success) {
          throw new Error('Failed to save notebooks to file system')
        }
      } catch (error) {
        logger.error('[ElectronStorage] Failed to save notebooks:', error)
        throw error
      }
    } else {
      localStorage.setItem(this.LEGACY_NOTEBOOKS_KEY, JSON.stringify(notebooks))
    }
  }

  // Settings operations
  async getSettings(): Promise<Partial<Settings>> {
    if (this.isElectron) {
      try {
        return await window.electronAPI!.storage.loadSettings()
      } catch (error) {
        logger.error('[ElectronStorage] Failed to load settings:', error)
        return {}
      }
    } else {
      return this.getLegacySettings()
    }
  }

  async saveSettings(settings: Partial<Settings>): Promise<void> {
    if (this.isElectron) {
      try {
        const result = await window.electronAPI!.storage.saveSettings(settings)
        if (!result.success) {
          throw new Error('Failed to save settings to file system')
        }
      } catch (error) {
        logger.error('[ElectronStorage] Failed to save settings:', error)
        throw error
      }
    } else {
      localStorage.setItem(this.LEGACY_SETTINGS_KEY, JSON.stringify(settings))
    }
  }

  // Tag colors operations
  async getTagColors(): Promise<Record<string, string>> {
    console.log('🔄 electronStorage.getTagColors: Starting async load...')
    if (this.isElectron) {
      try {
        console.log('🔄 electronStorage.getTagColors: Trying Electron API first...')
        const electronResult = await window.electronAPI!.storage.loadTagColors()
        console.log('🔄 electronStorage.getTagColors: Electron API result:', JSON.stringify(electronResult, null, 2))
        
        // If Electron storage has data, use it
        if (electronResult && Object.keys(electronResult).length > 0) {
          return electronResult
        }
        
        // Otherwise, fallback to localStorage (our current reliable source)
        console.log('🔄 electronStorage.getTagColors: Electron storage empty, falling back to localStorage...')
        return this.getTagColorsSync()
      } catch (error) {
        logger.error('[ElectronStorage] Failed to load tag colors:', error)
        console.log('🔄 electronStorage.getTagColors: Error occurred, falling back to localStorage...')
        return this.getTagColorsSync()
      }
    } else {
      return this.getLegacyTagColors()
    }
  }

  async saveTagColors(tagColors: Record<string, string>): Promise<void> {
    if (this.isElectron) {
      try {
        const result = await window.electronAPI!.storage.saveTagColors(tagColors)
        if (!result.success) {
          throw new Error('Failed to save tag colors to file system')
        }
      } catch (error) {
        logger.error('[ElectronStorage] Failed to save tag colors:', error)
        throw error
      }
    } else {
      localStorage.setItem(this.LEGACY_TAG_COLORS_KEY, JSON.stringify(tagColors))
    }
  }

  // Utility methods
  async clear(): Promise<void> {
    if (this.isElectron) {
      // In Electron, we would need to implement a clear all operation
      logger.warn('[ElectronStorage] Clear operation not implemented for file system storage')
    } else {
      localStorage.removeItem(this.LEGACY_NOTES_KEY)
      localStorage.removeItem(this.LEGACY_NOTEBOOKS_KEY)
      localStorage.removeItem(this.LEGACY_SETTINGS_KEY)
      localStorage.removeItem(this.LEGACY_TAG_COLORS_KEY)
    }
  }

  async export(): Promise<string> {
    const data = {
      notes: await this.getNotes(),
      notebooks: await this.getNotebooks(),
      settings: await this.getSettings(),
      tagColors: await this.getTagColors(),
      exportedAt: new Date().toISOString()
    }
    
    return JSON.stringify(data, null, 2)
  }

  async import(data: string): Promise<void> {
    try {
      const parsed = JSON.parse(data)
      
      if (parsed.notes) await this.saveNotes(parsed.notes)
      if (parsed.notebooks) await this.saveNotebooks(parsed.notebooks)
      if (parsed.settings) await this.saveSettings(parsed.settings)
      if (parsed.tagColors) await this.saveTagColors(parsed.tagColors)
      
      logger.info('[ElectronStorage] Import completed successfully')
    } catch (error) {
      logger.error('[ElectronStorage] Import failed:', error)
      throw new Error('Invalid import data format')
    }
  }

  // Storage information (Electron only)
  async getStorageInfo() {
    if (this.isElectron) {
      try {
        return await window.electronAPI!.storage.getStorageInfo()
      } catch (error) {
        logger.error('[ElectronStorage] Failed to get storage info:', error)
        return null
      }
    }
    return null
  }

  async getDataDirectory(): Promise<string | null> {
    if (this.isElectron) {
      try {
        return await window.electronAPI!.storage.getDataDirectory()
      } catch (error) {
        logger.error('[ElectronStorage] Failed to get data directory:', error)
        return null
      }
    }
    return null
  }

  // Check if running in Electron
  get isElectronEnvironment(): boolean {
    return this.isElectron
  }
}

// Export singleton instance
export const electronStorageService = new ElectronStorageService()