import { db } from '../../index'
import { subjects } from '../db/schema'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

const createSubjectSchema = z.object({
  semester_id: z.number().int().positive(),
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(20),
  credits: z.number().int().min(1).max(10),
})

export const subjectsRoute = new Hono()
  .get('/semester/:semesterId', async (c) => {
    const semesterId = Number(c.req.param('semesterId'))

    if (isNaN(semesterId)) {
      return c.json({ error: 'Invalid semester ID' }, 400)
    }

    const semesterSubjects = await db
      .select()
      .from(subjects)
      .where(eq(subjects.semester_id, semesterId))

    if (semesterSubjects.length === 0) {
      return c.json({ message: 'No subjects found for this semester' }, 404)
    }

    return c.json(semesterSubjects)
  })
  .post('/', zValidator('json', createSubjectSchema), async (c) => {
    const data = await c.req.valid('json')

    const [newSubject] = await db.insert(subjects).values(data).returning()

    if (!newSubject) {
      return c.json({ error: 'Error creating subject' }, 500)
    }

    return c.json(newSubject)
  })
