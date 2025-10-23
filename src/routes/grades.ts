import { db } from '../../index'
import { grades, subjects, semesters } from '../db/schema'
import { zValidator } from '@hono/zod-validator'
import { eq, inArray } from 'drizzle-orm'
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
  .get('/semester/:semesterId', async (c) => {
    const semesterId = Number(c.req.param('semesterId'))
    const userId = Number(c.req.query('userId'))

    if (isNaN(semesterId)) {
      return c.json({ error: 'Invalid semester ID' }, 400)
    }

    // Verifica que el semestre exista y pertenezca al usuario
    if (!isNaN(userId)) {
      const [semester] = await db
        .select()
        .from(semesters)
        .where(eq(semesters.id, semesterId))

      if (!semester || semester.user_id !== userId) {
        return c.json({ error: 'Semester not found for this user' }, 404)
      }
    }

    // Obtiene las materias del semestre
    const semesterSubjects = await db
      .select()
      .from(subjects)
      .where(eq(subjects.semester_id, semesterId))

    if (semesterSubjects.length === 0) {
      return c.json({ message: 'No subjects found for this semester' }, 404)
    }

    // IDs de materias
    const subjectIds = semesterSubjects.map((s) => s.id)

    // Obtiene las notas de las materias
    const semesterGrades = await db
      .select()
      .from(grades)
      .where(inArray(grades.subject_id, subjectIds))

    // Construye la respuesta
    const result = semesterSubjects.map((subject) => {
      const subjectGrades = semesterGrades.filter(
        (g) => g.subject_id === subject.id,
      )

      // Cálculo ponderado
      let totalWeight = 0
      let weightedScore = 0

      for (const g of subjectGrades) {
        if (g.score != null && g.weight != null) {
          totalWeight += g.weight
          weightedScore += g.score * g.weight
        }
      }

      const currentGrade = totalWeight > 0 ? weightedScore / totalWeight : null

      // Cálculo de cuánto falta para pasar
      let neededScore: number | null = null

      if (totalWeight < 100) {
        const remainingWeight = 100 - totalWeight
        const required = (5 * 100 - weightedScore) / remainingWeight
        neededScore = Math.max(0, Math.min(5, required)) // límite 0–5
      }

      const passed = currentGrade !== null ? currentGrade >= 5 : false

      return {
        ...subject,
        currentGrade: currentGrade ? Number(currentGrade.toFixed(2)) : null,
        neededScore:
          neededScore !== null ? Number(neededScore.toFixed(2)) : null,
        passed,
        grades: subjectGrades,
      }
    })

    return c.json({
      semesterId,
      subjects: result,
    })
  })
  .post('/', zValidator('json', createGradeSchema), async (c) => {
    const data = await c.req.valid('json')

    const [newGrade] = await db.insert(grades).values(data).returning()

    if (!newGrade) return c.json({ error: 'Error creating grade' }, 500)

    return c.json(newGrade)
  })
