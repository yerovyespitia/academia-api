import { db } from '../../index'
import { glossary_terms, semesters, subjects } from '../db/schema'
import { zValidator } from '@hono/zod-validator'
import { eq, inArray } from 'drizzle-orm'
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
  .get('/user/:userId', async (c) => {
    const userId = Number(c.req.param('userId'))
    if (isNaN(userId)) return c.json({ error: 'Invalid user ID' }, 400)

    // Obtener los semestres del usuario
    const userSemesters = await db
      .select()
      .from(semesters)
      .where(eq(semesters.user_id, userId))

    if (userSemesters.length === 0) {
      return c.json(
        { message: 'No se encontraron semestres para este usuario' },
        404,
      )
    }

    // Obtener los subjects de esos semestres
    const semesterIds = userSemesters.map((s) => s.id)
    const userSubjects = await db
      .select()
      .from(subjects)
      .where(inArray(subjects.semester_id, semesterIds))

    if (userSubjects.length === 0) {
      return c.json(
        { message: 'No se encontraron materias para este usuario' },
        404,
      )
    }

    // Obtener todos los glossary_terms de esos subjects
    const subjectIds = userSubjects.map((s) => s.id)
    const allGlossaries = await db
      .select()
      .from(glossary_terms)
      .where(inArray(glossary_terms.subject_id, subjectIds))

    if (allGlossaries.length === 0) {
      return c.json(
        { message: 'No se encontraron glosarios para este usuario' },
        404,
      )
    }

    // Agrupar glosarios por materia
    const groupedBySubject = userSubjects.map((subject) => ({
      ...subject,
      glossary: allGlossaries.filter((g) => g.subject_id === subject.id),
    }))

    return c.json({
      userId,
      totalSubjects: userSubjects.length,
      totalGlossaryTerms: allGlossaries.length,
      subjects: groupedBySubject,
    })
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
  .delete('/subject/:subjectId', async (c) => {
    const subjectId = Number(c.req.param('subjectId'))

    if (isNaN(subjectId)) {
      return c.json({ error: 'Invalid subject ID' }, 400)
    }

    // Verificar si existen glosarios para ese subject
    const existing = await db
      .select()
      .from(glossary_terms)
      .where(eq(glossary_terms.subject_id, subjectId))

    if (existing.length === 0) {
      return c.json(
        { message: 'No se encontraron glosarios para este subject' },
        404,
      )
    }

    // Eliminar los registros
    await db
      .delete(glossary_terms)
      .where(eq(glossary_terms.subject_id, subjectId))

    return c.json({
      message: `Se eliminaron ${existing.length} glosarios del subject ${subjectId}`,
      deleted: existing.length,
    })
  })
  .delete('/:id', async (c) => {
    const id = Number(c.req.param('id'))

    if (isNaN(id)) {
      return c.json({ error: 'Invalid glossary term ID' }, 400)
    }

    // Verificar si el término existe
    const [term] = await db
      .select()
      .from(glossary_terms)
      .where(eq(glossary_terms.id, id))

    if (!term) {
      return c.json({ message: 'No se encontró el término' }, 404)
    }

    // Eliminar el término
    await db.delete(glossary_terms).where(eq(glossary_terms.id, id))

    return c.json({
      message: `Término eliminado correctamente`,
      deletedTerm: term.term,
    })
  })
