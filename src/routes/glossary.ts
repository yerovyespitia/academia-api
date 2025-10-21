import { db } from '../../index'
import { glossary_terms } from '../db/schema'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

const createGlossarySchema = z.object({
  class: z.string(),
  subject_id: z.number().int().positive(),
  terms: z.array(
    z.object({
      name: z.string(),
      definition: z.string(),
      example: z.string(),
      topic: z.string(),
    }),
  ),
})

export const glossaryRoute = new Hono()
  .get('/subject/:subjectId', async (c) => {
    // Get glossary terms by subject ID
    const subjectId = Number(c.req.param('subjectId'))
    if (isNaN(subjectId)) return c.json({ error: 'Invalid subject ID' }, 400)

    const results = await db
      .select()
      .from(glossary_terms)
      .where(eq(glossary_terms.subject_id, subjectId))

    if (results.length === 0)
      return c.json(
        { message: 'No se encontraron términos para este subject' },
        404,
      )

    return c.json(results)
  })
  .post('/', zValidator('json', createGlossarySchema), async (c) => {
    // Create glossary terms by IA
    const data = await c.req.valid('json')

    const records = data.terms.map((t) => ({
      subject_id: data.subject_id,
      term: t.name,
      definition: `${t.definition}\n\n**Ejemplo:** ${t.example}\n**Tema:** ${t.topic}`,
      source: 'ai' as const,
    }))

    await db.insert(glossary_terms).values(records)

    return c.json({
      message: 'Glosario almacenado correctamente',
      total: records.length,
    })
  })
  .post('/manual', async (c) => {
    // Create glossary term manually
    const body = await c.req.json<{
      subject_id: number
      term: string
      definition: string
    }>()
    const [term] = await db
      .insert(glossary_terms)
      .values({
        subject_id: body.subject_id,
        term: body.term,
        definition: body.definition,
        source: 'user',
      })
      .returning()

    if (!term) return c.json({ error: 'Error creando término' }, 500)
    return c.json(term)
  })
