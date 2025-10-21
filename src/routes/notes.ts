import { db } from '../../index'
import { notes } from '../db/schema'
import { zValidator } from '@hono/zod-validator'
import { eq, and } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

const createNoteSchema = z.object({
  document_id: z.number().optional(),
  user_id: z.number().int().positive(),
  subject_id: z.number().int().positive().optional(),
  title: z.string().min(2).max(100),
  content: z.string().min(1),
  format: z.enum(['markdown', 'latex', 'text']),
})

export const notesRoute = new Hono()
  .get('/user/:userId', async (c) => {
    // Get all notes for a specific user
    const userId = Number(c.req.param('userId'))
    if (isNaN(userId)) return c.json({ error: 'Invalid user ID' }, 400)

    const userNotes = await db
      .select()
      .from(notes)
      .where(eq(notes.user_id, userId))
    if (userNotes.length === 0)
      return c.json({ message: 'No notes found for this user' }, 404)

    return c.json(userNotes)
  })
  .get('/user/:userId/subject/:subjectId', async (c) => {
    // Get all notes for a specific user and subject
    const userId = Number(c.req.param('userId'))
    const subjectId = Number(c.req.param('subjectId'))
    if (isNaN(userId) || isNaN(subjectId))
      return c.json({ error: 'Invalid IDs' }, 400)

    const subjectNotes = await db
      .select()
      .from(notes)
      .where(and(eq(notes.user_id, userId), eq(notes.subject_id, subjectId)))

    if (subjectNotes.length === 0)
      return c.json({ message: 'No notes found for this subject' }, 404)

    return c.json(subjectNotes)
  })
  .post('/', zValidator('json', createNoteSchema), async (c) => {
    const data = await c.req.valid('json')
    const [newNote] = await db.insert(notes).values(data).returning()
    if (!newNote) return c.json({ error: 'Error creating note' }, 500)
    return c.json(newNote)
  })
