import { db } from '../../index'
import { users } from '../db/schema'
import { zValidator } from '@hono/zod-validator'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

const createUserSchema = z.object({
  name: z.string().min(3).max(40),
  email: z.email(),
  password_hash: z.string().min(6),
  school: z.string().min(2).max(80),
})

export const usersRoute = new Hono()
  .get('/', async (c) => {
    const allUsers = await db.select().from(users)
    return c.json(allUsers)
  })
  .post('/', zValidator('json', createUserSchema), async (c) => {
    const user = await c.req.valid('json')

    const hashedPassword = await bcrypt.hash(user.password_hash, 10)

    const [newUser] = await db
      .insert(users)
      .values({
        ...user,
        password_hash: hashedPassword,
      })
      .returning()

    if (!newUser) {
      return c.json({ error: 'Error creating user' }, 500)
    }

    const { password_hash, ...safeUser } = newUser

    return c.json(safeUser)
  })
  .get('/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const [userFound] = await db.select().from(users).where(eq(users.id, id))
    if (!userFound) return c.notFound()
    return c.json(userFound)
  })
