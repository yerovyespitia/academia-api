import { db } from '../../index'
import { documents } from '../db/schema'
import { zValidator } from '@hono/zod-validator'
import { eq, and } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

const createDocumentSchema = z.object({
  user_id: z.number().int().positive(),
  subject_id: z.number().int().positive().optional(),
  title: z.string().min(2).max(100),
  type: z.enum(['image', 'pdf', 'voice', 'text']),
  file_url: z.url(),
  extracted_text: z.string().optional(),
})

export const documentsRoute = new Hono()
  .get('/user/:userId', async (c) => {
    // Get documents by user ID
    const userId = Number(c.req.param('userId'))
    if (isNaN(userId)) return c.json({ error: 'Invalid user ID' }, 400)

    const userDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.user_id, userId))
    if (userDocuments.length === 0) {
      return c.json({ message: 'No documents found for this user' }, 404)
    }

    return c.json(userDocuments)
  })
  .get('/user/:userId/subject/:subjectId', async (c) => {
    // Get documents by user ID and subject ID
    const userId = Number(c.req.param('userId'))
    const subjectId = Number(c.req.param('subjectId'))

    if (isNaN(userId) || isNaN(subjectId))
      return c.json({ error: 'Invalid ids' }, 400)

    const subjectDocs = await db
      .select()
      .from(documents)
      .where(
        and(eq(documents.user_id, userId), eq(documents.subject_id, subjectId)),
      )

    if (subjectDocs.length === 0) {
      return c.json(
        { message: 'No documents found for this subject and user' },
        404,
      )
    }

    return c.json(subjectDocs)
  })
  .post('/', zValidator('json', createDocumentSchema), async (c) => {
    const data = await c.req.valid('json')
    const [newDoc] = await db.insert(documents).values(data).returning()
    if (!newDoc) return c.json({ error: 'Error creating document' }, 500)
    return c.json(newDoc)
  })
