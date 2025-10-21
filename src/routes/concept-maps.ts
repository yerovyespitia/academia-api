import { db } from '../../index'
import { concept_maps } from '../db/schema'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

const createConceptMapSchema = z.object({
  topic: z.string(),
  subject_id: z.number().int().positive(),
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      description: z.string().optional(),
      level: z.number().int().min(0).max(12).optional(),
    }),
  ),
  edges: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      relation: z.string(),
    }),
  ),
})

export const conceptMapsRoute = new Hono()
  .get('/subject/:subjectId', async (c) => {
    // Get concept maps by subject ID
    const subjectId = Number(c.req.param('subjectId'))
    if (isNaN(subjectId)) return c.json({ error: 'Invalid subject ID' }, 400)

    const maps = await db
      .select()
      .from(concept_maps)
      .where(eq(concept_maps.subject_id, subjectId))

    if (maps.length === 0)
      return c.json({ message: 'No concept maps found for this subject' }, 404)

    const parsed = maps.map((m) => ({
      ...m,
      data: JSON.parse(m.data),
    }))

    return c.json(parsed)
  })
  .get('/:id', async (c) => {
    // Get concept map by ID
    const id = Number(c.req.param('id'))
    if (isNaN(id)) return c.json({ error: 'Invalid map ID' }, 400)

    const [map] = await db
      .select()
      .from(concept_maps)
      .where(eq(concept_maps.id, id))

    if (!map) return c.json({ message: 'Concept map not found' }, 404)

    return c.json({ ...map, data: JSON.parse(map.data) })
  })
  .post('/', zValidator('json', createConceptMapSchema), async (c) => {
    const data = await c.req.valid('json')

    const graph = {
      topic: data.topic,
      nodes: data.nodes,
      edges: data.edges,
    }

    const [newMap] = await db
      .insert(concept_maps)
      .values({
        subject_id: data.subject_id,
        data: JSON.stringify(graph),
      })
      .returning()

    if (!newMap) return c.json({ error: 'Error creando mapa conceptual' }, 500)

    return c.json({
      message: 'Mapa conceptual almacenado correctamente',
      concept_map_id: newMap.id,
      topic: data.topic,
    })
  })
