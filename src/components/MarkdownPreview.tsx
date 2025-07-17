import React, { useMemo, useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import DOMPurify from 'dompurify'
import { Note } from '../types'
import { MarkdownProcessor } from '../lib/markdown'

interface MarkdownPreviewProps {
  note: Note | null
  className?: string
  syncScroll?: boolean
  onScrollSync?: (scrollTop: number, scrollHeight: number) => void
}

export interface MarkdownPreviewHandle {
  syncScrollPosition: (scrollTop: number, scrollHeight: number) => void
}

// DOMPurify configuration - back to original with syntax highlighting support
const purifyConfig = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'div', 'span',
    'strong', 'b', 'em', 'i', 'u', 'code', 'pre',
    'blockquote',
    'ul', 'ol', 'li',
    'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'hr', 'del', 'ins',
    'input' // For task list checkboxes
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'class', 'id',
    'target', 'rel',
    'type', 'checked', 'disabled' // Checkbox attributes
  ],
  ALLOW_DATA_ATTR: false,
  ADD_TAGS: ['span'],
  ALLOWED_SCHEMES: ['http', 'https', 'mailto', 'tel', 'data'],
  // Allow basic syntax highlighting classes
  ALLOWED_CLASSES: {
    'pre': ['hljs'],
    'code': ['hljs', /^language-/, /^hljs-/],
    'span': [/^hljs-/, 'env-var', 'blockquote-icon'],
    'blockquote': ['blockquote', 'blockquote-note', 'blockquote-warning', 'blockquote-tip', 'blockquote-important'],
    'li': ['task-list-item'],
    'table': ['enhanced-table'],
    'hr': ['enhanced-hr'],
    'a': ['external-link'],
    'div': ['table-wrapper']
  }
}

const MarkdownPreview = forwardRef<MarkdownPreviewHandle, MarkdownPreviewProps>(({
  note,
  className = '',
  syncScroll = false,
  onScrollSync
}, ref) => {
  const previewRef = useRef<HTMLDivElement>(null)

  // Convert markdown to HTML with syntax highlighting and sanitization
  const htmlContent = useMemo(() => {
    if (!note?.content) return ''

    try {
      // Use MarkdownProcessor for enhanced rendering with syntax highlighting
      const rawHtml = MarkdownProcessor.render(note.content)
      
      // Sanitize HTML to prevent XSS attacks while preserving highlight.js classes
      const sanitizedHtml = DOMPurify.sanitize(rawHtml, purifyConfig)
      
      return sanitizedHtml
    } catch (error) {
      console.error('Error parsing markdown:', error)
      return `<pre>${DOMPurify.sanitize(note.content)}</pre>` // Fallback to sanitized plain text
    }
  }, [note?.content])

  // Handle scroll sync
  useEffect(() => {
    if (!syncScroll || !onScrollSync || !previewRef.current) return

    const handleScroll = () => {
      if (previewRef.current) {
        const { scrollTop, scrollHeight } = previewRef.current
        onScrollSync(scrollTop, scrollHeight)
      }
    }

    const previewElement = previewRef.current
    previewElement.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      previewElement.removeEventListener('scroll', handleScroll)
    }
  }, [syncScroll, onScrollSync])

  // Sync scroll position when controlled externally
  const syncScrollPosition = (scrollTop: number, scrollHeight: number) => {
    if (previewRef.current) {
      const { scrollHeight: currentScrollHeight } = previewRef.current
      const ratio = scrollTop / scrollHeight
      previewRef.current.scrollTop = ratio * currentScrollHeight
    }
  }

  // Expose scroll sync method via ref
  useImperativeHandle(ref, () => ({
    syncScrollPosition
  }), [syncScrollPosition])

  if (!note) {
    return (
      <div className={`flex items-center justify-center h-full bg-theme-bg-primary ${className}`}>
        <div className="text-center">
          <div className="text-6xl mb-4 opacity-50">📝</div>
          <h3 className="text-lg font-medium text-theme-text-secondary mb-2">
            No note selected
          </h3>
          <p className="text-theme-text-muted">
            Select a note to see the preview
          </p>
        </div>
      </div>
    )
  }

  if (!note.content) {
    return (
      <div className={`flex items-center justify-center h-full bg-theme-bg-primary ${className}`}>
        <div className="text-center">
          <div className="text-6xl mb-4 opacity-50">✏️</div>
          <h3 className="text-lg font-medium text-theme-text-secondary mb-2">
            Empty note
          </h3>
          <p className="text-theme-text-muted">
            Start writing to see the preview
          </p>
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={previewRef}
      className={`h-full overflow-y-auto overflow-x-hidden bg-theme-bg-primary custom-scrollbar ${className}`}
    >
      <div className="p-6 max-w-none overflow-hidden">
        {/* Note metadata */}
        <div className="mb-6 pb-4 border-b border-theme-border-primary">
          <h1 className="text-2xl font-bold text-theme-text-primary mb-2">
            {note.title || 'Untitled'}
          </h1>
          
          <div className="flex items-center gap-4 text-sm text-theme-text-muted">
            <span>
              Updated: {new Date(note.updatedAt).toLocaleDateString()}
            </span>
            
            {note.notebook && (
              <span className="flex items-center gap-1">
                📁 {note.notebook}
              </span>
            )}
            
            {note.tags.length > 0 && (
              <div className="flex items-center gap-1">
                <span>🏷️</span>
                <span>{note.tags.join(', ')}</span>
              </div>
            )}
            
            {note.isPinned && (
              <span className="text-theme-accent-orange">📌 Pinned</span>
            )}
          </div>
        </div>

        {/* Rendered markdown content */}
        <div 
          className="prose-theme max-w-none break-words overflow-wrap-anywhere"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </div>
    </div>
  )
})

MarkdownPreview.displayName = 'MarkdownPreview'

export { MarkdownPreview }