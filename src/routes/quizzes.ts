import { db } from '../../index'
import { quizzes, quiz_questions } from '../db/schema'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

const createQuizSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  class: z.string().min(1),
  subject_id: z.number().int().positive(),
  questions: z
    .array(
      z.object({
        id: z.number().int().nonnegative(),
        question: z.string().min(1),
        options: z.array(z.string().min(1)).min(2),
        correctAnswer: z.number().int().nonnegative(),
      }),
    )
    .min(1),
})

export const quizzesRoute = new Hono()
  .get('/subject/:subjectId', async (c) => {
    // Get quizzes by subject ID
    const subjectId = Number(c.req.param('subjectId'))
    if (isNaN(subjectId)) return c.json({ error: 'Invalid subject ID' }, 400)

    const subjectQuizzes = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.subject_id, subjectId))

    if (subjectQuizzes.length === 0)
      return c.json({ message: 'No quizzes found for this subject' }, 404)

    return c.json(subjectQuizzes)
  })
  .get('/:quizId/questions', async (c) => {
    // Get questions for a specific quiz
    const quizId = Number(c.req.param('quizId'))
    if (isNaN(quizId)) return c.json({ error: 'Invalid quiz ID' }, 400)

    const questions = await db
      .select()
      .from(quiz_questions)
      .where(eq(quiz_questions.quiz_id, quizId))

    const formatted = questions.map((q) => ({
      ...q,
      options: q.options ? JSON.parse(q.options) : [],
    }))

    return c.json(formatted)
  })
  .post('/', zValidator('json', createQuizSchema), async (c) => {
    const quizData = await c.req.valid('json')

    // 1️⃣ Insertar quiz principal
    const [createdQuiz] = await db
      .insert(quizzes)
      .values({
        subject_id: quizData.subject_id,
        name: quizData.name,
        class: quizData.class,
        source: 'notes',
      })
      .returning()

    if (!createdQuiz) {
      return c.json({ error: 'Error creating quiz' }, 500)
    }

    // 2️⃣ Crear preguntas
    const questionRecords = quizData.questions.map((q) => ({
      quiz_id: createdQuiz.id,
      type: 'multiple_choice' as const,
      question_text: q.question,
      options: JSON.stringify(q.options),
      correct_answer: q.options[q.correctAnswer] ?? '',
      user_answer: null,
      feedback_ai: null,
    }))

    // 3️⃣ Insertar preguntas relacionadas
    const insertedQuestions = await db
      .insert(quiz_questions)
      .values(questionRecords)
      .returning()

    return c.json({
      message: 'Quiz creado con éxito',
      quiz: {
        ...createdQuiz,
        total_questions: insertedQuestions.length,
      },
    })
  })
