// Simplified NotesList component
import React, { memo, useState, useCallback, useMemo } from 'react'
import { Note } from '../../types'
import { useNotesListLogic } from '../../hooks/useNotesListLogic'
import { useAppStore } from '../../stores/newSimpleStore'
import NotesHeader from '../notes/NotesHeader'
import EmptyNotesState from '../notes/EmptyNotesState'
import NotesList from '../notes/NotesList'
import VirtualizedNotesList from '../notes/VirtualizedNotesList'

type SortField = 'title' | 'date' | 'updated' | 'notebook'
type SortDirection = 'asc' | 'desc'

interface NotesListSimpleProps {
  notes: Note[]
  selectedNoteId?: string
  onOpenNote: (noteId: string) => void
  onNewNote: () => void
  onTogglePin: (note: Note) => void
  onDeleteNote: (note: Note) => void
  onDuplicateNote: (note: Note) => void
  onMoveToNotebook?: (note: Note) => void
  onRestoreNote?: (note: Note) => void
  onPermanentDelete?: (note: Note) => void
  currentSection?: string
  isTrashView?: boolean
  onSortNotes?: (sortBy: string) => void
}

const NotesListSimple: React.FC<NotesListSimpleProps> = memo(({
  notes,
  selectedNoteId,
  onOpenNote,
  onNewNote,
  onTogglePin,
  onDeleteNote,
  onDuplicateNote,
  onMoveToNotebook,
  onRestoreNote,
  onPermanentDelete,
  currentSection = 'notes',
  isTrashView = false,
  onSortNotes
}) => {
  const { isEmpty } = useNotesListLogic(notes)
  const { sortBy, sortDirection, setSortBy, setSortDirection } = useAppStore()
  const [searchTerm, setSearchTerm] = useState('')

  // Filter and sort notes based on search term and sort criteria
  const filteredAndSortedNotes = useMemo(() => {
    // First filter by search term
    let filtered = notes
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase()
      filtered = notes.filter(note => 
        note.title.toLowerCase().includes(searchLower) ||
        note.content.toLowerCase().includes(searchLower) ||
        note.tags.some(tag => tag.toLowerCase().includes(searchLower))
      )
    }
    
    // Then sort the filtered results
    const sorted = [...filtered].sort((a, b) => {
      let aValue: string | number | Date
      let bValue: string | number | Date
      
      switch (sortBy) {
        case 'title':
          aValue = a.title.toLowerCase()
          bValue = b.title.toLowerCase()
          break
        case 'date':
          aValue = new Date(a.createdAt)
          bValue = new Date(b.createdAt)
          break
        case 'updated':
          aValue = new Date(a.updatedAt)
          bValue = new Date(b.updatedAt)
          break
        case 'notebook':
          aValue = a.notebook?.toLowerCase() || ''
          bValue = b.notebook?.toLowerCase() || ''
          break
        default:
          aValue = new Date(a.updatedAt)
          bValue = new Date(b.updatedAt)
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
    
    return sorted
  }, [notes, searchTerm, sortBy, sortDirection])

  // Performance settings
  const VIRTUALIZATION_THRESHOLD = 100 // Use virtualization when more than 100 notes
  const shouldUseVirtualization = filteredAndSortedNotes.length > VIRTUALIZATION_THRESHOLD
  
  const notesCount = filteredAndSortedNotes.length

  const handleSort = useCallback((field: SortField, direction: SortDirection) => {
    setSortBy(field)
    setSortDirection(direction)
  }, [setSortBy, setSortDirection])

  const handleNoteClick = useCallback((noteId: string) => {
    onOpenNote(noteId)
  }, [onOpenNote])

  const getDynamicTitle = useCallback(() => {
    if (currentSection === 'all-notes') return 'All Notes'
    if (currentSection === 'recent') return 'Recent'
    if (currentSection === 'pinned') return 'Pinned'
    if (currentSection === 'trash') return 'Trash'
    if (currentSection?.startsWith('notebook-')) {
      const notebookName = currentSection.replace('notebook-', '').replace('-', ' ')
      return notebookName.charAt(0).toUpperCase() + notebookName.slice(1)
    }
    if (currentSection?.startsWith('tag-')) {
      const tagName = currentSection.replace('tag-', '')
      return `#${tagName}`
    }
    if (currentSection === 'in-progress') return 'In Progress'
    if (currentSection === 'review') return 'Review'
    if (currentSection === 'completed') return 'Completed'
    if (currentSection === 'archived') return 'Archived'
    return 'Notes'
  }, [currentSection])

  if (isEmpty) {
    return (
      <EmptyNotesState
        title={getDynamicTitle()}
        currentSection={currentSection}
        currentSortBy={sortBy}
        currentSortDirection={sortDirection}
        onSort={handleSort}
        onNewNote={onNewNote}
      />
    )
  }

  return (
    <div className="h-full flex flex-col bg-theme-bg-primary">
      {/* Header */}
      <NotesHeader
        title={getDynamicTitle()}
        notesCount={notesCount}
        currentSortBy={sortBy}
        currentSortDirection={sortDirection}
        onSort={handleSort}
        onNewNote={onNewNote}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
      />

      {/* Notes List */}
      <div className="flex-1 overflow-hidden min-h-0">
        {shouldUseVirtualization ? (
          <VirtualizedNotesList
            notes={filteredAndSortedNotes}
            selectedNote={filteredAndSortedNotes.find(n => n.id === selectedNoteId) || null}
            onNoteSelect={(note) => handleNoteClick(note.id)}
            onNoteDelete={(noteId) => {
              const note = filteredAndSortedNotes.find(n => n.id === noteId)
              if (note) onDeleteNote(note)
            }}
            onNoteDuplicate={onDuplicateNote}
            searchQuery={searchTerm}
            className="h-full"
          />
        ) : (
          <div className="h-full overflow-y-auto overflow-x-hidden custom-scrollbar">
            <NotesList
              notes={filteredAndSortedNotes}
              selectedNoteId={selectedNoteId}
              onNoteClick={handleNoteClick}
              onTogglePin={onTogglePin}
              onDeleteNote={onDeleteNote}
              onDuplicateNote={onDuplicateNote}
              onMoveToNotebook={onMoveToNotebook}
              onRestoreNote={onRestoreNote}
              onPermanentDelete={onPermanentDelete}
              isTrashView={isTrashView}
            />
          </div>
        )}
      </div>
    </div>
  )
})

NotesListSimple.displayName = 'NotesListSimple'

export default NotesListSimple