import { db } from '../../index'
import { semesters } from '../db/schema'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

const createSemesterSchema = z.object({
  user_id: z.number().int().positive(),
  year: z.number().int().positive().min(2000).max(2099),
  period: z.string().min(1).max(40),
})

export const semestersRoute = new Hono()
  .get('/user/:userId', async (c) => {
    const userId = Number(c.req.param('userId'))

    if (isNaN(userId)) {
      return c.json({ error: 'Invalid user ID' }, 400)
    }

    const userSemesters = await db
      .select()
      .from(semesters)
      .where(eq(semesters.user_id, userId))

    if (userSemesters.length === 0) {
      return c.json({ message: 'No semesters found for this user' }, 404)
    }

    return c.json(userSemesters)
  })
  .post('/', zValidator('json', createSemesterSchema), async (c) => {
    const data = await c.req.valid('json')

    const [newSemester] = await db.insert(semesters).values(data).returning()

    if (!newSemester) {
      return c.json({ error: 'Error creating semester' }, 500)
    }

    return c.json(newSemester)
  })
