import { db } from '../../index'
import { grades } from '../db/schema'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

const createGradeSchema = z.object({
  subject_id: z.number().int().positive(),
  name: z.string().min(2).max(100),
  weight: z.number().min(0).max(100),
  score: z.number().min(0).max(5).optional(), // ejemplo si trabajas de 0 a 5
  max_score: z.number().min(0).max(5).optional(),
})

export const gradesRoute = new Hono()
  .get('/subject/:subjectId', async (c) => {
    const subjectId = Number(c.req.param('subjectId'))
    if (isNaN(subjectId)) {
      return c.json({ error: 'Invalid subject ID' }, 400)
    }

    const subjectGrades = await db
      .select()
      .from(grades)
      .where(eq(grades.subject_id, subjectId))

    if (subjectGrades.length === 0) {
      return c.json({ message: 'No grades found for this subject' }, 404)
    }

    return c.json(subjectGrades)
  })
  .post('/', zValidator('json', createGradeSchema), async (c) => {
    const data = await c.req.valid('json')

    const [newGrade] = await db.insert(grades).values(data).returning()

    if (!newGrade) return c.json({ error: 'Error creating grade' }, 500)

    return c.json(newGrade)
  })
