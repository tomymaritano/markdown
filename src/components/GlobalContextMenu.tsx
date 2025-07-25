import { useEffect, useState } from 'react'
import { useAppStore } from '../stores/newSimpleStore'
import { useNoteActions } from '../hooks/useNoteActions'
import { useToast } from '../hooks/useToast'
import { useNotebooks } from '../hooks/useNotebooks'
import RenameModal from './modals/RenameModal'
import ConfirmModal from './modals/ConfirmModal'
import TagColorModal from './modals/TagColorModal'

const GlobalContextMenu: React.FC = () => {
  const { setModal, setActiveSection, removeTagFromAllNotes, notes } = useAppStore()
  const { createNewNote, handlePermanentDelete } = useNoteActions()
  const { showToast } = useToast()
  const { updateNotebook, deleteNotebook, getNotebook } = useNotebooks()
  const navStore = useAppStore()
  
  // Rename modal state
  const [renameModal, setRenameModal] = useState({
    isOpen: false,
    type: '' as 'notebook' | 'tag',
    id: '',
    currentName: ''
  })
  
  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'warning' as 'danger' | 'warning' | 'info'
  })
  
  // Tag color modal state
  const [tagColorModal, setTagColorModal] = useState({
    isOpen: false,
    tagName: ''
  })
  
  useEffect(() => {
    if (!window.electronAPI?.isElectron) return
    
    // Handle general context menu actions
    const handleCreateNewNote = () => {
      createNewNote()
    }
    
    const handleOpenSearch = () => {
      setModal('search', true)
    }
    
    const handleOpenSettingsModal = () => {
      setModal('settings', true)
    }
    
    const handleCreateNewNotebook = () => {
      setModal('notebookManager', true)
    }
    
    const handleCollapseAllNotebooks = () => {
      navStore.collapseAllSections()
      showToast('All notebooks collapsed', 'success')
    }
    
    const handleExpandAllNotebooks = () => {
      navStore.expandAllSections()
      showToast('All notebooks expanded', 'success')
    }
    
    const handleCreateNoteInNotebook = (notebookId: string) => {
      // Create a new note and assign it to the notebook
      const newNote = createNewNote()
      if (newNote) {
        // TODO: Update note with notebook
        showToast('Note created in notebook', 'success')
      }
    }
    
    const handleRenameNotebook = (notebookId: string) => {
      const notebook = getNotebook(notebookId)
      if (!notebook) return
      
      setRenameModal({
        isOpen: true,
        type: 'notebook',
        id: notebookId,
        currentName: notebook.name
      })
    }
    
    const handleDeleteNotebook = (notebookId: string) => {
      const notebook = getNotebook(notebookId)
      if (!notebook) return
      
      setConfirmModal({
        isOpen: true,
        title: 'Delete Notebook',
        message: `Are you sure you want to delete the notebook "${notebook.name}"? All notes in this notebook will be moved to trash.`,
        type: 'danger',
        onConfirm: () => {
          const success = deleteNotebook(notebookId)
          if (success) {
            showToast(`Notebook "${notebook.name}" deleted`, 'success')
          } else {
            showToast('Failed to delete notebook', 'error')
          }
        }
      })
    }
    
    const handleRenameTag = (tagName: string) => {
      setRenameModal({
        isOpen: true,
        type: 'tag',
        id: tagName,
        currentName: tagName
      })
    }
    
    const handleChangeTagColor = (tagName: string) => {
      setTagColorModal({
        isOpen: true,
        tagName: tagName
      })
    }
    
    const handleRemoveTag = (tagName: string) => {
      setConfirmModal({
        isOpen: true,
        title: 'Remove Tag',
        message: `Are you sure you want to remove the tag "${tagName}" from all notes?`,
        type: 'warning',
        onConfirm: () => {
          const count = removeTagFromAllNotes(tagName)
          showToast(`Tag "${tagName}" removed from ${count} notes`, 'success')
        }
      })
    }
    
    const handleEmptyTrash = () => {
      const trashedNotes = notes.filter(note => note.isTrashed)
      if (trashedNotes.length === 0) {
        showToast('Trash is already empty', 'info')
        return
      }
      
      setConfirmModal({
        isOpen: true,
        title: 'Empty Trash',
        message: `Are you sure you want to permanently delete ${trashedNotes.length} notes in trash? This action cannot be undone.`,
        type: 'danger',
        onConfirm: async () => {
          for (const note of trashedNotes) {
            await handlePermanentDelete(note)
          }
          showToast(`${trashedNotes.length} notes permanently deleted`, 'success')
        }
      })
    }
    
    // Listen for all context menu events
    window.electronAPI.on('create-new-note', handleCreateNewNote)
    window.electronAPI.on('open-search', handleOpenSearch)
    window.electronAPI.on('open-settings-modal', handleOpenSettingsModal)
    window.electronAPI.on('create-new-notebook', handleCreateNewNotebook)
    window.electronAPI.on('collapse-all-notebooks', handleCollapseAllNotebooks)
    window.electronAPI.on('expand-all-notebooks', handleExpandAllNotebooks)
    window.electronAPI.on('create-note-in-notebook', handleCreateNoteInNotebook)
    window.electronAPI.on('rename-notebook', handleRenameNotebook)
    window.electronAPI.on('delete-notebook', handleDeleteNotebook)
    window.electronAPI.on('rename-tag', handleRenameTag)
    window.electronAPI.on('change-tag-color', handleChangeTagColor)
    window.electronAPI.on('remove-tag', handleRemoveTag)
    window.electronAPI.on('empty-trash', handleEmptyTrash)
    
    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeAllListeners('create-new-note')
        window.electronAPI.removeAllListeners('open-search')
        window.electronAPI.removeAllListeners('open-settings-modal')
        window.electronAPI.removeAllListeners('create-new-notebook')
        window.electronAPI.removeAllListeners('collapse-all-notebooks')
        window.electronAPI.removeAllListeners('expand-all-notebooks')
        window.electronAPI.removeAllListeners('create-note-in-notebook')
        window.electronAPI.removeAllListeners('rename-notebook')
        window.electronAPI.removeAllListeners('delete-notebook')
        window.electronAPI.removeAllListeners('rename-tag')
        window.electronAPI.removeAllListeners('change-tag-color')
        window.electronAPI.removeAllListeners('remove-tag')
        window.electronAPI.removeAllListeners('empty-trash')
      }
    }
  }, [createNewNote, setModal, setActiveSection, showToast, removeTagFromAllNotes])
  
  // Handle rename submission
  const handleRenameSubmit = (newName: string) => {
    if (renameModal.type === 'notebook') {
      const success = updateNotebook(renameModal.id, { name: newName })
      if (success) {
        showToast(`Notebook renamed to "${newName}"`, 'success')
      } else {
        showToast('Failed to rename notebook', 'error')
      }
    } else if (renameModal.type === 'tag') {
      // TODO: Implement tag rename functionality
      showToast('Tag rename functionality coming soon', 'info')
    }
  }
  
  return (
    <>
      <RenameModal
        isOpen={renameModal.isOpen}
        onClose={() => setRenameModal({ ...renameModal, isOpen: false })}
        currentName={renameModal.currentName}
        title={renameModal.type === 'notebook' ? 'Rename Notebook' : 'Rename Tag'}
        onRename={handleRenameSubmit}
      />
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText={confirmModal.type === 'danger' ? 'Delete' : 'Confirm'}
      />
      <TagColorModal
        isOpen={tagColorModal.isOpen}
        onClose={() => setTagColorModal({ ...tagColorModal, isOpen: false })}
        tagName={tagColorModal.tagName}
      />
    </>
  )
}

export default GlobalContextMenu