import { db } from '../../index'
import { users } from '../db/schema'
import { zValidator } from '@hono/zod-validator'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import jwt from 'jsonwebtoken'
import { z } from 'zod'

const createUserSchema = z.object({
  name: z.string().min(3).max(40),
  email: z.email(),
  password_hash: z.string().min(6),
  school: z.string().min(2).max(80),
})

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
})

export const usersRoute = new Hono()
  .get('/', async (c) => {
    const allUsers = await db.select().from(users)
    return c.json(allUsers)
  })
  .get('/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const [userFound] = await db.select().from(users).where(eq(users.id, id))
    if (!userFound) return c.notFound()
    return c.json(userFound)
  })
  .post('/login', zValidator('json', loginSchema), async (c) => {
    const { email, password } = await c.req.valid('json')

    // Buscar usuario por email
    const [user] = await db.select().from(users).where(eq(users.email, email))

    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    // Verificar contraseña
    const validPassword = await bcrypt.compare(password, user.password_hash)
    if (!validPassword) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    // Generar token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '1d' },
    )

    const { password_hash, ...safeUser } = user

    return c.json({ user: safeUser, token })
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
