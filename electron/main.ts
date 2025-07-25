import { app, BrowserWindow, Menu, shell, ipcMain, MenuItemConstructorOptions, dialog, clipboard } from 'electron'
import { autoUpdater } from 'electron-updater'
import * as path from 'path'
import { promises as fs } from 'fs'
import * as fsSync from 'fs'

// Type definitions
interface Note {
  id: string
  title: string
  content: string
  tags: string[]
  notebook?: string
  isPinned?: boolean
  createdAt: string
  updatedAt: string
  isTrashed?: boolean
}

interface Notebook {
  id: string
  name: string
  color: string
  level: number
  parentId?: string | null
}

interface Settings {
  theme: string
  fontSize: number
  editorMode: string
  [key: string]: any
}

interface StorageResult {
  success: boolean
  path?: string
  message?: string
  backupPath?: string
  error?: string
}

interface DragState {
  isDragging: boolean
  startPosition: { x: number; y: number } | null
  windowStartPosition: { x: number; y: number } | null
}

interface DragData {
  startX?: number
  startY?: number
  currentX?: number
  currentY?: number
}

interface StorageInfo {
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
}


interface MetadataAction {
  action: string
  data: any
  timestamp: string
}

interface Metadata {
  created: string
  actions: MetadataAction[]
}

interface ExportOptions {
  format: 'html' | 'markdown' | 'pdf'
  includeMetadata?: boolean
}

interface ExportResult {
  success: boolean
  filePath?: string
  error?: string
}

// Global variables
let mainWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null

// File System Storage Service - Inkdrop Style
class FileSystemStorageService {
  private readonly dataDir: string
  private readonly notesDir: string
  private readonly backupDir: string
  private readonly metadataFile: string
  private readonly notebooksFile: string
  private readonly settingsFile: string
  private readonly tagColorsFile: string

  constructor() {
    this.dataDir = path.join(app.getPath('userData'), 'viny-data')
    this.notesDir = path.join(this.dataDir, 'notes')
    this.backupDir = path.join(this.dataDir, 'backups')
    this.metadataFile = path.join(this.dataDir, 'metadata.json')
    this.notebooksFile = path.join(this.dataDir, 'notebooks.json')
    this.settingsFile = path.join(this.dataDir, 'settings.json')
    this.tagColorsFile = path.join(this.dataDir, 'tag-colors.json')
    
    this.initializeDirectories()
  }

  async initializeDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true })
      await fs.mkdir(this.notesDir, { recursive: true })
      await fs.mkdir(this.backupDir, { recursive: true })
      console.log('[StorageService] Initialized directories at:', this.dataDir)
    } catch (error) {
      console.error('[StorageService] Failed to initialize directories:', error)
    }
  }

  // Generate backup filename with timestamp
  generateBackupPath(filename: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const ext = path.extname(filename)
    const name = path.basename(filename, ext)
    return path.join(this.backupDir, `${name}-${timestamp}${ext}`)
  }

  // Create backup before modifying file
  async createFileBackup(filePath: string): Promise<string | null> {
    try {
      if (fsSync.existsSync(filePath)) {
        const backupPath = this.generateBackupPath(path.basename(filePath))
        await fs.copyFile(filePath, backupPath)
        console.log('[StorageService] Created backup:', backupPath)
        return backupPath
      }
    } catch (error) {
      console.warn('[StorageService] Failed to create backup for:', filePath, error)
    }
    return null
  }

  // Save individual note with backup
  async saveNote(note: Note): Promise<StorageResult> {
    if (!note || !note.id) {
      throw new Error('Invalid note: missing id')
    }

    const noteFile = path.join(this.notesDir, `note-${note.id}.json`)
    
    try {
      // Create backup of existing note
      await this.createFileBackup(noteFile)
      
      // Save new note
      await fs.writeFile(noteFile, JSON.stringify(note, null, 2))
      console.log('[StorageService] Saved note:', note.id)
      
      // Update metadata
      await this.updateMetadata('note_saved', { id: note.id, title: note.title })
      
      return { success: true, path: noteFile }
    } catch (error: any) {
      console.error('[StorageService] Failed to save note:', note.id, error)
      throw new Error(`Failed to save note: ${error.message}`)
    }
  }

  // Load individual note
  async loadNote(id: string): Promise<Note | null> {
    const noteFile = path.join(this.notesDir, `note-${id}.json`)
    
    try {
      const data = await fs.readFile(noteFile, 'utf-8')
      return JSON.parse(data) as Note
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null // Note not found
      }
      console.error('[StorageService] Failed to load note:', id, error)
      throw new Error(`Failed to load note: ${error.message}`)
    }
  }

  // Load all notes
  async loadAllNotes(): Promise<Note[]> {
    try {
      const files = await fs.readdir(this.notesDir)
      const noteFiles = files.filter(file => file.startsWith('note-') && file.endsWith('.json'))
      
      const notes: Note[] = []
      for (const file of noteFiles) {
        try {
          const filePath = path.join(this.notesDir, file)
          const data = await fs.readFile(filePath, 'utf-8')
          const note = JSON.parse(data) as Note
          notes.push(note)
        } catch (error) {
          console.warn('[StorageService] Failed to load note file:', file, error)
          // Continue loading other notes even if one fails
        }
      }
      
      console.log('[StorageService] Loaded', notes.length, 'notes')
      return notes
    } catch (error) {
      console.error('[StorageService] Failed to load notes:', error)
      return []
    }
  }

  // Delete note with backup
  async deleteNote(id: string): Promise<StorageResult> {
    const noteFile = path.join(this.notesDir, `note-${id}.json`)
    
    try {
      if (fsSync.existsSync(noteFile)) {
        // Create backup before deletion
        const backupPath = await this.createFileBackup(noteFile)
        
        // Delete the note
        await fs.unlink(noteFile)
        console.log('[StorageService] Deleted note:', id)
        
        // Update metadata
        await this.updateMetadata('note_deleted', { id, backupPath })
        
        return { success: true, backupPath: backupPath || undefined }
      }
      return { success: false, error: 'Note not found' }
    } catch (error: any) {
      console.error('[StorageService] Failed to delete note:', id, error)
      throw new Error(`Failed to delete note: ${error.message}`)
    }
  }

  // Save/load other data types with backup
  async saveDataFile(filePath: string, data: any): Promise<StorageResult> {
    try {
      await this.createFileBackup(filePath)
      await fs.writeFile(filePath, JSON.stringify(data, null, 2))
      return { success: true }
    } catch (error: any) {
      console.error('[StorageService] Failed to save data file:', filePath, error)
      throw new Error(`Failed to save data: ${error.message}`)
    }
  }

  async loadDataFile<T>(filePath: string, defaultValue: T): Promise<T> {
    try {
      const data = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(data) as T
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return defaultValue
      }
      
      // If JSON parsing fails, try to recover or use default value
      if (error instanceof SyntaxError) {
        console.warn('[StorageService] Invalid JSON in file:', filePath, error.message)
        
        // For metadata.json, we can safely recreate it
        if (filePath === this.metadataFile) {
          console.log('[StorageService] Recreating metadata file with default value')
          await this.saveDataFile(filePath, defaultValue)
          return defaultValue
        }
        
        // For other files, create a backup and use default value
        const backupPath = await this.createFileBackup(filePath)
        console.log('[StorageService] Created backup of corrupted file:', backupPath)
        return defaultValue
      }
      
      console.error('[StorageService] Failed to load data file:', filePath, error)
      throw new Error(`Failed to load data: ${error.message}`)
    }
  }

  // Notebooks operations
  async saveNotebooks(notebooks: Notebook[]): Promise<StorageResult> {
    return this.saveDataFile(this.notebooksFile, notebooks)
  }

  async loadNotebooks(): Promise<Notebook[]> {
    return this.loadDataFile<Notebook[]>(this.notebooksFile, [])
  }

  // Settings operations
  async saveSettings(settings: Partial<Settings>): Promise<StorageResult> {
    return this.saveDataFile(this.settingsFile, settings)
  }

  async loadSettings(): Promise<Partial<Settings>> {
    return this.loadDataFile<Partial<Settings>>(this.settingsFile, {})
  }

  // Tag colors operations
  async saveTagColors(tagColors: Record<string, string>): Promise<StorageResult> {
    return this.saveDataFile(this.tagColorsFile, tagColors)
  }

  async loadTagColors(): Promise<Record<string, string>> {
    return this.loadDataFile<Record<string, string>>(this.tagColorsFile, {})
  }

  // Update metadata file
  async updateMetadata(action: string, data: any): Promise<void> {
    try {
      let metadata = await this.loadDataFile<Metadata>(this.metadataFile, {
        created: new Date().toISOString(),
        actions: []
      })
      
      metadata.actions.push({
        action,
        data,
        timestamp: new Date().toISOString()
      })
      
      // Keep only last 1000 actions
      if (metadata.actions.length > 1000) {
        metadata.actions = metadata.actions.slice(-1000)
      }
      
      await this.saveDataFile(this.metadataFile, metadata)
    } catch (error) {
      console.warn('[StorageService] Failed to update metadata:', error)
    }
  }

  // Migration from localStorage
  async migrateFromLocalStorage(data: any): Promise<StorageResult> {
    try {
      console.log('[StorageService] Starting migration from localStorage')
      
      if (data.notes && Array.isArray(data.notes)) {
        for (const note of data.notes) {
          await this.saveNote(note)
        }
        console.log('[StorageService] Migrated', data.notes.length, 'notes')
      }
      
      if (data.notebooks) {
        await this.saveNotebooks(data.notebooks)
        console.log('[StorageService] Migrated notebooks')
      }
      
      if (data.settings) {
        await this.saveSettings(data.settings)
        console.log('[StorageService] Migrated settings')
      }
      
      if (data.tagColors) {
        await this.saveTagColors(data.tagColors)
        console.log('[StorageService] Migrated tag colors')
      }
      
      await this.updateMetadata('migration_completed', {
        source: 'localStorage',
        notesCount: data.notes?.length || 0
      })
      
      return { success: true, message: 'Migration completed successfully' }
    } catch (error: any) {
      console.error('[StorageService] Migration failed:', error)
      throw new Error(`Migration failed: ${error.message}`)
    }
  }

  // Get storage information
  async getStorageInfo(): Promise<StorageInfo> {
    try {
      const notes = await this.loadAllNotes()
      const notebooks = await this.loadNotebooks()
      const settings = await this.loadSettings()
      const tagColors = await this.loadTagColors()
      
      return {
        dataDirectory: this.dataDir,
        notesCount: notes.length,
        notebooksCount: notebooks.length,
        hasSettings: Object.keys(settings).length > 0,
        tagColorsCount: Object.keys(tagColors).length,
        directories: {
          data: this.dataDir,
          notes: this.notesDir,
          backups: this.backupDir
        }
      }
    } catch (error: any) {
      console.error('[StorageService] Failed to get storage info:', error)
      throw new Error(`Failed to get storage info: ${error.message}`)
    }
  }

  // Get data directory path
  getDataDirectory(): string {
    return this.dataDir
  }
}

// Initialize storage service
const storageService = new FileSystemStorageService()

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 15, y: 10 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // Performance optimizations
      experimentalFeatures: false,
      v8CacheOptions: 'code',
      backgroundThrottling: false,
    },
    title: 'Viny v1.3.0 - Note Taking App',
    show: false,
    minWidth: 800,
    minHeight: 600,
  })

  const isDev = process.env.NODE_ENV === 'development'

  // Security: Prevent new window creation
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    // Try different ports since Vite might use 5174
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
    console.log('Loading dev URL:', devUrl)
    mainWindow.loadURL(devUrl)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })
}

// Create settings window
function createSettingsWindow(): void {
  if (settingsWindow) {
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    width: 900,
    height: 600,
    parent: mainWindow!,
    modal: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'default',
    title: 'Viny Settings',
    minWidth: 800,
    minHeight: 500,
  })

  const isDev = process.env.NODE_ENV === 'development'

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
    settingsWindow.loadURL(`${devUrl}#/settings`)
  } else {
    settingsWindow.loadFile(path.join(__dirname, '../../dist/index.html'), {
      hash: '/settings',
    })
  }

  settingsWindow.once('ready-to-show', () => {
    settingsWindow?.show()
  })

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}

// IPC handlers
ipcMain.on('open-settings', () => {
  createSettingsWindow()
})

// Window control handlers
ipcMain.on('window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize()
  }
})

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }
})

ipcMain.on('window-unmaximize', () => {
  if (mainWindow) {
    mainWindow.unmaximize()
  }
})

ipcMain.on('window-close', () => {
  if (mainWindow) {
    mainWindow.close()
  }
})

// Manual window dragging handlers - more reliable control
let dragState: DragState = {
  isDragging: false,
  startPosition: null,
  windowStartPosition: null,
}

ipcMain.on('window-drag-start', (event, data: DragData) => {
  if (!mainWindow) return

  const windowBounds = mainWindow.getBounds()
  dragState = {
    isDragging: true,
    startPosition: { x: data.startX || 0, y: data.startY || 0 },
    windowStartPosition: { x: windowBounds.x, y: windowBounds.y },
  }
})

ipcMain.on('window-drag-move', (event, data: DragData) => {
  if (!mainWindow || !dragState.isDragging || !dragState.startPosition || !dragState.windowStartPosition) return

  const deltaX = (data.currentX || 0) - dragState.startPosition.x
  const deltaY = (data.currentY || 0) - dragState.startPosition.y

  const newX = dragState.windowStartPosition.x + deltaX
  const newY = dragState.windowStartPosition.y + deltaY

  mainWindow.setPosition(newX, newY)
})

ipcMain.on('window-drag-end', () => {
  dragState = {
    isDragging: false,
    startPosition: null,
    windowStartPosition: null,
  }
})

// Storage IPC Handlers - File System Operations
ipcMain.handle('storage-save-note', async (event, note: Note): Promise<StorageResult> => {
  try {
    return await storageService.saveNote(note)
  } catch (error) {
    console.error('[IPC] storage-save-note failed:', error)
    throw error
  }
})

ipcMain.handle('storage-load-note', async (event, id: string): Promise<Note | null> => {
  try {
    return await storageService.loadNote(id)
  } catch (error) {
    console.error('[IPC] storage-load-note failed:', error)
    throw error
  }
})

ipcMain.handle('storage-load-all-notes', async (): Promise<Note[]> => {
  try {
    return await storageService.loadAllNotes()
  } catch (error) {
    console.error('[IPC] storage-load-all-notes failed:', error)
    throw error
  }
})

ipcMain.handle('storage-delete-note', async (event, id: string): Promise<StorageResult> => {
  try {
    return await storageService.deleteNote(id)
  } catch (error) {
    console.error('[IPC] storage-delete-note failed:', error)
    throw error
  }
})

ipcMain.handle('storage-save-notebooks', async (event, notebooks: Notebook[]): Promise<StorageResult> => {
  try {
    return await storageService.saveNotebooks(notebooks)
  } catch (error) {
    console.error('[IPC] storage-save-notebooks failed:', error)
    throw error
  }
})

ipcMain.handle('storage-load-notebooks', async (): Promise<Notebook[]> => {
  try {
    return await storageService.loadNotebooks()
  } catch (error) {
    console.error('[IPC] storage-load-notebooks failed:', error)
    throw error
  }
})

ipcMain.handle('storage-save-settings', async (event, settings: Partial<Settings>): Promise<StorageResult> => {
  try {
    return await storageService.saveSettings(settings)
  } catch (error) {
    console.error('[IPC] storage-save-settings failed:', error)
    throw error
  }
})

ipcMain.handle('storage-load-settings', async (): Promise<Partial<Settings>> => {
  try {
    return await storageService.loadSettings()
  } catch (error) {
    console.error('[IPC] storage-load-settings failed:', error)
    throw error
  }
})

ipcMain.handle('storage-save-tag-colors', async (event, tagColors: Record<string, string>): Promise<StorageResult> => {
  try {
    return await storageService.saveTagColors(tagColors)
  } catch (error) {
    console.error('[IPC] storage-save-tag-colors failed:', error)
    throw error
  }
})

ipcMain.handle('storage-load-tag-colors', async (): Promise<Record<string, string>> => {
  try {
    return await storageService.loadTagColors()
  } catch (error) {
    console.error('[IPC] storage-load-tag-colors failed:', error)
    throw error
  }
})

ipcMain.handle('storage-migrate-from-localStorage', async (event, data: any): Promise<StorageResult> => {
  try {
    return await storageService.migrateFromLocalStorage(data)
  } catch (error) {
    console.error('[IPC] storage-migrate-from-localStorage failed:', error)
    throw error
  }
})

ipcMain.handle('storage-get-info', async (): Promise<StorageInfo> => {
  try {
    return await storageService.getStorageInfo()
  } catch (error) {
    console.error('[IPC] storage-get-info failed:', error)
    throw error
  }
})

ipcMain.handle('storage-get-data-directory', async (): Promise<string> => {
  try {
    return storageService.getDataDirectory()
  } catch (error) {
    console.error('[IPC] storage-get-data-directory failed:', error)
    throw error
  }
})

// Native Export Handlers
ipcMain.handle('export-save-dialog', async (event, defaultFileName: string, filters: Electron.FileFilter[]): Promise<string | null> => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: defaultFileName,
    filters: filters
  })
  
  return result.canceled ? null : result.filePath
})

ipcMain.handle('export-note-to-file', async (event, note: Note, filePath: string, options: ExportOptions): Promise<ExportResult> => {
  try {
    let content = ''
    
    if (options.format === 'markdown') {
      // Generate Markdown content
      if (options.includeMetadata) {
        content += `# ${note.title}\n\n`
        content += `**Notebook:** ${note.notebook || 'Uncategorized'}\n`
        content += `**Created:** ${new Date(note.createdAt).toLocaleDateString()}\n`
        if (note.updatedAt) {
          content += `**Updated:** ${new Date(note.updatedAt).toLocaleDateString()}\n`
        }
        if (note.tags && note.tags.length > 0) {
          content += `**Tags:** ${note.tags.join(', ')}\n`
        }
        content += '\n---\n\n'
      }
      content += note.content || ''
    } else if (options.format === 'html') {
      // Generate HTML content
      const { marked } = await import('marked')
      const html = marked(note.content || '', { breaks: true, gfm: true })
      
      const metadata = options.includeMetadata
        ? `
        <div class="note-metadata">
          <h1>${note.title}</h1>
          <div class="metadata-info">
            <span><strong>Notebook:</strong> ${note.notebook || 'Uncategorized'}</span>
            <span><strong>Created:</strong> ${new Date(note.createdAt).toLocaleDateString()}</span>
            ${note.updatedAt ? `<span><strong>Updated:</strong> ${new Date(note.updatedAt).toLocaleDateString()}</span>` : ''}
            ${note.tags && note.tags.length > 0 ? `<span><strong>Tags:</strong> ${note.tags.join(', ')}</span>` : ''}
          </div>
        </div>
        <hr />
      `
        : ''
      
      content = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${note.title} - Viny Export</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 800px;
              margin: 0 auto;
              padding: 2rem;
              background: #fff;
            }
            .note-metadata {
              margin-bottom: 2rem;
              padding: 1rem;
              background: #f8f9fa;
              border-radius: 6px;
              border-left: 4px solid #007acc;
            }
            .note-metadata h1 {
              margin: 0 0 1rem 0;
              color: #007acc;
              font-size: 2rem;
            }
            .metadata-info {
              display: flex;
              flex-direction: column;
              gap: 0.5rem;
              font-size: 0.9rem;
              color: #666;
            }
            h1 { color: #007acc; }
            h2 { color: #2aa198; }
            h3 { color: #6c71c4; }
            code {
              background: #f1f3f4;
              padding: 0.2rem 0.4rem;
              border-radius: 3px;
              font-family: 'Monaco', 'Consolas', monospace;
            }
            pre {
              background: #f8f9fa;
              border: 1px solid #e9ecef;
              border-radius: 6px;
              padding: 1rem;
              overflow-x: auto;
            }
            blockquote {
              border-left: 4px solid #6c71c4;
              margin: 1.5rem 0;
              padding: 1rem 1.5rem;
              background: #f8f9fa;
              font-style: italic;
            }
          </style>
        </head>
        <body>
          ${metadata}
          <div class="note-content">
            ${html}
          </div>
        </body>
        </html>
      `
    }
    
    // Write the file
    await fs.writeFile(filePath, content, 'utf-8')
    
    return {
      success: true,
      filePath: filePath
    }
  } catch (error: any) {
    console.error('[IPC] export-note-to-file failed:', error)
    return {
      success: false,
      error: error.message
    }
  }
})

ipcMain.handle('export-note-to-pdf', async (event, note: Note, filePath: string, options: ExportOptions): Promise<ExportResult> => {
  try {
    // Create a hidden window for PDF generation
    const pdfWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })
    
    // Generate HTML content
    const { marked } = await import('marked')
    const html = marked(note.content || '', { breaks: true, gfm: true })
    
    const metadata = options.includeMetadata
      ? `
      <div class="note-metadata">
        <h1>${note.title}</h1>
        <div class="metadata-info">
          <span><strong>Notebook:</strong> ${note.notebook || 'Uncategorized'}</span>
          <span><strong>Created:</strong> ${new Date(note.createdAt).toLocaleDateString()}</span>
          ${note.updatedAt ? `<span><strong>Updated:</strong> ${new Date(note.updatedAt).toLocaleDateString()}</span>` : ''}
          ${note.tags && note.tags.length > 0 ? `<span><strong>Tags:</strong> ${note.tags.join(', ')}</span>` : ''}
        </div>
      </div>
      <hr />
    `
      : ''
    
    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 2rem;
          }
          .note-metadata {
            margin-bottom: 2rem;
            padding: 1rem;
            background: #f8f9fa;
            border-radius: 6px;
            border-left: 4px solid #007acc;
          }
          .note-metadata h1 {
            margin: 0 0 1rem 0;
            color: #007acc;
          }
          .metadata-info {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            font-size: 0.9rem;
            color: #666;
          }
          code {
            background: #f1f3f4;
            padding: 0.2rem 0.4rem;
            border-radius: 3px;
            font-family: monospace;
          }
          pre {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            padding: 1rem;
            overflow-x: auto;
          }
          blockquote {
            border-left: 4px solid #6c71c4;
            margin: 1.5rem 0;
            padding: 1rem 1.5rem;
            background: #f8f9fa;
          }
        </style>
      </head>
      <body>
        ${metadata}
        <div class="note-content">
          ${html}
        </div>
      </body>
      </html>
    `
    
    // Load the HTML
    await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`)
    
    // Generate PDF
    const pdfData = await pdfWindow.webContents.printToPDF({
      pageSize: 'A4',
      margins: {
        top: 1,
        bottom: 1,
        left: 1,
        right: 1
      }
    })
    
    // Save PDF to file
    await fs.writeFile(filePath, pdfData)
    
    // Close the window
    pdfWindow.close()
    
    return {
      success: true,
      filePath: filePath
    }
  } catch (error: any) {
    console.error('[IPC] export-note-to-pdf failed:', error)
    return {
      success: false,
      error: error.message
    }
  }
})

// Show item in folder after export
ipcMain.handle('show-item-in-folder', async (event, filePath: string): Promise<void> => {
  shell.showItemInFolder(filePath)
})

ipcMain.handle('open-note-in-new-window', async (event, noteId: string): Promise<void> => {
  try {
    const note = await storageService.loadNote(noteId)
    if (note) {
      createNoteWindow(note)
    } else {
      throw new Error(`Note with ID ${noteId} not found`)
    }
  } catch (error) {
    console.error('Error opening note in new window:', error)
    throw error
  }
})

// Note synchronization between windows
ipcMain.on('broadcast-note-update', (event, note: Note) => {
  // Get all windows
  const windows = BrowserWindow.getAllWindows()
  
  // Broadcast to all windows except the sender
  windows.forEach(window => {
    if (window.webContents !== event.sender) {
      window.webContents.send('note-updated', note)
    }
  })
  
  // Also save to storage
  storageService.saveNote(note).catch(error => {
    console.error('[IPC] Failed to save note during broadcast:', error)
  })
})

// Generic Context Menu Handler
ipcMain.on('show-context-menu', (event, data: { type: string, context?: any }) => {
  let template: MenuItemConstructorOptions[] = []
  
  switch (data.type) {
    case 'general':
      template = [
        {
          label: 'New Note',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            event.sender.send('create-new-note')
          }
        },
        { type: 'separator' },
        {
          label: 'Search Notes',
          accelerator: 'CmdOrCtrl+K',
          click: () => {
            event.sender.send('open-search')
          }
        },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            event.sender.send('open-settings-modal')
          }
        }
      ]
      break
      
    case 'editor':
      template = [
        {
          label: 'Cut',
          accelerator: 'CmdOrCtrl+X',
          role: 'cut'
        },
        {
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          role: 'copy'
        },
        {
          label: 'Paste',
          accelerator: 'CmdOrCtrl+V',
          role: 'paste'
        },
        { type: 'separator' },
        {
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          role: 'selectAll'
        }
      ]
      break
      
    case 'sidebar':
      template = [
        {
          label: 'New Note',
          click: () => {
            event.sender.send('create-new-note')
          }
        },
        {
          label: 'New Notebook',
          click: () => {
            event.sender.send('create-new-notebook')
          }
        },
        { type: 'separator' },
        {
          label: 'Collapse All',
          click: () => {
            event.sender.send('collapse-all-notebooks')
          }
        },
        {
          label: 'Expand All',
          click: () => {
            event.sender.send('expand-all-notebooks')
          }
        }
      ]
      break
      
    case 'notebook':
      const notebook = data.context
      template = [
        {
          label: 'New Note in Notebook',
          click: () => {
            event.sender.send('create-note-in-notebook', notebook.id)
          }
        },
        {
          label: 'Rename Notebook',
          click: () => {
            event.sender.send('rename-notebook', notebook.id)
          }
        },
        { type: 'separator' },
        {
          label: 'Delete Notebook',
          click: () => {
            event.sender.send('delete-notebook', notebook.id)
          }
        }
      ]
      break
      
    case 'tag':
      const tag = data.context
      template = [
        {
          label: 'Rename Tag',
          click: () => {
            event.sender.send('rename-tag', tag.name)
          }
        },
        {
          label: 'Change Color',
          click: () => {
            event.sender.send('change-tag-color', tag.name)
          }
        },
        { type: 'separator' },
        {
          label: 'Remove Tag',
          click: () => {
            event.sender.send('remove-tag', tag.name)
          }
        }
      ]
      break
      
    case 'trash':
      template = [
        {
          label: 'Empty Trash',
          click: () => {
            event.sender.send('empty-trash')
          }
        }
      ]
      break
      
    default:
      return
  }
  
  const menu = Menu.buildFromTemplate(template)
  menu.popup()
})

// Context Menu for Notes (keep the existing one for backward compatibility)
ipcMain.on('show-note-context-menu', (event, note: Note) => {
  const template: MenuItemConstructorOptions[] = [
    {
      label: note.isPinned ? 'Unpin from Top' : 'Pin to Top',
      click: () => {
        event.sender.send('toggle-pin-note', note.id)
      }
    },
    { type: 'separator' },
    {
      label: 'Open in New Window',
      click: () => {
        createNoteWindow(note)
      }
    },
    {
      label: 'Duplicate Note',
      click: () => {
        event.sender.send('duplicate-note', note.id)
      }
    },
    { type: 'separator' },
    {
      label: 'Export',
      submenu: [
        {
          label: 'Export as HTML...',
          click: () => {
            event.sender.send('export-note', note.id, 'html')
          }
        },
        {
          label: 'Export as Markdown...',
          click: () => {
            event.sender.send('export-note', note.id, 'markdown')
          }
        },
        {
          label: 'Export as PDF...',
          click: () => {
            event.sender.send('export-note', note.id, 'pdf')
          }
        }
      ]
    },
    { type: 'separator' },
    {
      label: 'Move to Notebook',
      click: () => {
        event.sender.send('move-to-notebook', note.id)
      }
    },
    { type: 'separator' },
    {
      label: 'Copy Note ID',
      click: () => {
        clipboard.writeText(note.id)
      }
    },
    { type: 'separator' },
    {
      label: note.isTrashed ? 'Restore Note' : 'Move to Trash',
      click: () => {
        if (note.isTrashed) {
          event.sender.send('restore-note', note.id)
        } else {
          event.sender.send('delete-note', note.id)
        }
      }
    }
  ]
  
  // Add permanent delete option if note is already in trash
  if (note.isTrashed) {
    template.push({
      label: 'Delete Permanently',
      click: () => {
        event.sender.send('permanent-delete-note', note.id)
      }
    })
  }
  
  const menu = Menu.buildFromTemplate(template)
  menu.popup()
})

// Create a new window for a specific note
function createNoteWindow(note: Note): void {
  const noteWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 15, y: 10 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: `${note.title} - Viny`,
    show: false,
    minWidth: 600,
    minHeight: 400,
  })

  const isDev = process.env.NODE_ENV === 'development'

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
    noteWindow.loadURL(`${devUrl}#/note/${note.id}`)
  } else {
    noteWindow.loadFile(path.join(__dirname, '../../dist/index.html'), {
      hash: `/note/${note.id}`,
    })
  }

  noteWindow.once('ready-to-show', () => {
    noteWindow.show()
  })
}

app.whenReady().then(() => {
  createWindow()
  setupAutoUpdater()
  createMenu()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Auto-updater setup
function setupAutoUpdater(): void {
  // Configure auto-updater for private repository
  const token = process.env.GH_TOKEN
  
  if (token) {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'tomymaritano',
      repo: 'viny',
      private: true,
      token: token
    })
  }
  
  autoUpdater.checkForUpdatesAndNotify()

  // Auto-updater events
  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...')
  })

  autoUpdater.on('update-available', info => {
    console.log('Update available:', info.version)
  })

  autoUpdater.on('update-not-available', info => {
    console.log('Update not available:', info.version)
  })

  autoUpdater.on('error', err => {
    console.log('Error in auto-updater:', err)
  })

  autoUpdater.on('download-progress', progressObj => {
    let log_message = 'Download speed: ' + progressObj.bytesPerSecond
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%'
    log_message =
      log_message +
      ' (' +
      progressObj.transferred +
      '/' +
      progressObj.total +
      ')'
    console.log(log_message)
  })

  autoUpdater.on('update-downloaded', info => {
    console.log('Update downloaded:', info.version)
    autoUpdater.quitAndInstall()
  })
}

// Create application menu with update check
function createMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Viny',
      submenu: [
        {
          label: 'About Viny',
          role: 'about',
        },
        {
          label: 'Check for Updates...',
          click: () => {
            autoUpdater.checkForUpdatesAndNotify()
          },
        },
        { type: 'separator' },
        {
          label: 'Services',
          role: 'services',
          submenu: [],
        },
        { type: 'separator' },
        {
          label: 'Hide Viny',
          accelerator: 'Command+H',
          role: 'hide',
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          role: 'hideOthers',
        },
        {
          label: 'Show All',
          role: 'unhide',
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: () => {
            app.quit()
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        {
          label: 'Force Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          role: 'forceReload',
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          role: 'toggleDevTools',
        },
        { type: 'separator' },
        { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        {
          label: 'Toggle Fullscreen',
          accelerator: 'Ctrl+Command+F',
          role: 'togglefullscreen',
        },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { label: 'Minimize', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
        { label: 'Close', accelerator: 'CmdOrCtrl+W', role: 'close' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Viny Website',
          click: () => {
            shell.openExternal('https://viny.app')
          },
        },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal(
              'https://github.com/tomymaritano/viny/issues'
            )
          },
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}