import { Request, Response, NextFunction } from 'express'
import { prisma } from '../index'
import { CreateNotebookSchema, UpdateNotebookSchema } from '../types'
import { createError } from '../middleware/errorHandler'

// Get all notebooks
export const getNotebooks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notebooks = await prisma.notebook.findMany({
      orderBy: {
        name: 'asc'
      }
    })

    // Get note counts for each notebook
    const notebooksWithCounts = await Promise.all(
      notebooks.map(async (notebook) => {
        const noteCount = await prisma.note.count({
          where: {
            notebook: notebook.name,
            isTrashed: false
          }
        })

        return {
          id: notebook.id,
          name: notebook.name,
          color: notebook.color,
          createdAt: notebook.createdAt.toISOString(),
          noteCount
        }
      })
    )

    res.json(notebooksWithCounts)
  } catch (error) {
    next(error)
  }
}

// Get notebook by ID
export const getNotebookById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const notebookId = parseInt(id)

    if (isNaN(notebookId)) {
      throw createError('Invalid notebook ID', 400)
    }

    const notebook = await prisma.notebook.findUnique({
      where: { id: notebookId }
    })

    if (!notebook) {
      throw createError('Notebook not found', 404)
    }

    const noteCount = await prisma.note.count({
      where: {
        notebook: notebook.name,
        isTrashed: false
      }
    })

    const transformedNotebook = {
      id: notebook.id,
      name: notebook.name,
      color: notebook.color,
      createdAt: notebook.createdAt.toISOString(),
      noteCount
    }

    res.json(transformedNotebook)
  } catch (error) {
    next(error)
  }
}

// Create new notebook
export const createNotebook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = CreateNotebookSchema.parse(req.body)

    const notebook = await prisma.notebook.create({
      data: validatedData
    })

    const transformedNotebook = {
      id: notebook.id,
      name: notebook.name,
      color: notebook.color,
      createdAt: notebook.createdAt.toISOString(),
      noteCount: 0
    }

    res.status(201).json(transformedNotebook)
  } catch (error) {
    next(error)
  }
}

// Update notebook
export const updateNotebook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const notebookId = parseInt(id)

    if (isNaN(notebookId)) {
      throw createError('Invalid notebook ID', 400)
    }

    const validatedData = UpdateNotebookSchema.parse(req.body)

    const existingNotebook = await prisma.notebook.findUnique({
      where: { id: notebookId }
    })

    if (!existingNotebook) {
      throw createError('Notebook not found', 404)
    }

    // If name is being changed, update all notes with the old name
    if (validatedData.name && validatedData.name !== existingNotebook.name) {
      await prisma.note.updateMany({
        where: { notebook: existingNotebook.name },
        data: { notebook: validatedData.name }
      })
    }

    const notebook = await prisma.notebook.update({
      where: { id: notebookId },
      data: validatedData
    })

    const noteCount = await prisma.note.count({
      where: {
        notebook: notebook.name,
        isTrashed: false
      }
    })

    const transformedNotebook = {
      id: notebook.id,
      name: notebook.name,
      color: notebook.color,
      createdAt: notebook.createdAt.toISOString(),
      noteCount
    }

    res.json(transformedNotebook)
  } catch (error) {
    next(error)
  }
}

// Delete notebook
export const deleteNotebook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const notebookId = parseInt(id)

    if (isNaN(notebookId)) {
      throw createError('Invalid notebook ID', 400)
    }

    const notebook = await prisma.notebook.findUnique({
      where: { id: notebookId }
    })

    if (!notebook) {
      throw createError('Notebook not found', 404)
    }

    // Check if there are notes in this notebook
    const noteCount = await prisma.note.count({
      where: { notebook: notebook.name }
    })

    if (noteCount > 0) {
      // Move all notes to "Personal" notebook instead of deleting
      await prisma.note.updateMany({
        where: { notebook: notebook.name },
        data: { notebook: 'Personal' }
      })
    }

    // Delete notebook
    await prisma.notebook.delete({
      where: { id: notebookId }
    })

    res.status(204).send()
  } catch (error) {
    next(error)
  }
}