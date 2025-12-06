import { db } from '../../index'
import { quizzes, quiz_questions, subjects, semesters } from '../db/schema'
import { zValidator } from '@hono/zod-validator'
import { eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

// 🧩 Esquema que coincide con el frontend
const quizSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  class: z.string().min(1),
  subject_id: z.number().int().positive(),
  questions: z.array(
    z.object({
      id: z.number().int().nonnegative(),
      question: z.string().min(1),
      options: z.array(z.string().min(1)).length(4),
      correctAnswer: z.number().int().min(0).max(3),
    }),
  ),
})

export const quizzesRoute = new Hono()

  // 🟢 Crear un quiz (desde el frontend con OpenAI)
  .post('/', zValidator('json', quizSchema), async (c) => {
    const quizData = await c.req.valid('json')

    // Insertar el quiz
    const [createdQuiz] = await db
      .insert(quizzes)
      .values({
        subject_id: quizData.subject_id,
        name: quizData.name,
        class: quizData.class,
        source: 'notes',
      })
      .returning()

    if (!createdQuiz) return c.json({ error: 'Error creating quiz' }, 500)

    // Insertar preguntas
    const questionRecords = quizData.questions.map((q) => ({
      quiz_id: createdQuiz.id,
      type: 'multiple_choice' as const,
      question_text: q.question,
      options: JSON.stringify(q.options),
      correct_answer: q.options[q.correctAnswer],
      user_answer: null,
      feedback_ai: null,
    }))

    await db.insert(quiz_questions).values(questionRecords)

    return c.json({
      message: 'Quiz creado con éxito',
      quiz: createdQuiz,
      total_questions: questionRecords.length,
    })
  })

  // 🟡 Obtener quiz + preguntas
  .get('/:quizId/questions', async (c) => {
    const quizId = Number(c.req.param('quizId'))
    if (isNaN(quizId)) return c.json({ error: 'Invalid quiz ID' }, 400)

    const [quizInfo] = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.id, quizId))
    if (!quizInfo) return c.json({ error: 'Quiz not found' }, 404)

    const questions = await db
      .select()
      .from(quiz_questions)
      .where(eq(quiz_questions.quiz_id, quizId))

    const formatted = questions.map((q) => ({
      id: q.id,
      question: q.question_text,
      options: q.options ? JSON.parse(q.options) : [],
      correctAnswer: q.options
        ? JSON.parse(q.options).indexOf(q.correct_answer)
        : 0,
    }))

    return c.json({
      quiz: {
        id: quizInfo.id,
        name: quizInfo.name,
        class: quizInfo.class,
        subject_id: quizInfo.subject_id,
      },
      questions: formatted,
    })
  })

  // 🔵 Obtener todos los quizzes de un usuario (con preguntas incluidas)
  .get('/user/:userId', async (c) => {
    const userId = Number(c.req.param('userId'))
    if (isNaN(userId)) return c.json({ error: 'Invalid user ID' }, 400)

    // 1️⃣ Obtener quizzes de ese usuario
    const quizzesData = await db
      .select({
        quiz_id: quizzes.id,
        quiz_name: quizzes.name,
        quiz_class: quizzes.class,
        subject_id: subjects.id,
        subject_name: subjects.name,
      })
      .from(quizzes)
      .leftJoin(subjects, eq(quizzes.subject_id, subjects.id))
      .leftJoin(semesters, eq(subjects.semester_id, semesters.id))
      .where(eq(semesters.user_id, userId))

    if (quizzesData.length === 0)
      return c.json({ message: 'No quizzes found for this user' }, 404)

    // 2️⃣ Obtener preguntas asociadas
    const quizIds = quizzesData.map((q) => q.quiz_id)
    const allQuestions = await db
      .select()
      .from(quiz_questions)
      .where(sql`${quiz_questions.quiz_id} IN (${sql.join(quizIds, sql`,`)})`)

    // 3️⃣ Agrupar
    const formatted = quizzesData.map((quiz) => ({
      id: quiz.quiz_id,
      name: quiz.quiz_name,
      class: quiz.quiz_class,
      subject: {
        id: quiz.subject_id,
        name: quiz.subject_name,
      },
      questions: allQuestions
        .filter((q) => q.quiz_id === quiz.quiz_id)
        .map((q) => ({
          id: q.id,
          question: q.question_text,
          options: q.options ? JSON.parse(q.options) : [],
          correctAnswer: q.options
            ? JSON.parse(q.options).indexOf(q.correct_answer)
            : 0,
        })),
    }))

    return c.json({
      user_id: userId,
      total_quizzes: formatted.length,
      quizzes: formatted,
    })
  })
  .delete('/:quizId', async (c) => {
    const quizId = Number(c.req.param('quizId'))
    if (isNaN(quizId)) return c.json({ error: 'Invalid quiz ID' }, 400)

    // Verificar si el quiz existe
    const existingQuiz = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.id, quizId))

    if (existingQuiz.length === 0) {
      return c.json({ error: 'Quiz not found' }, 404)
    }

    // 1️⃣ Eliminar preguntas asociadas al quiz
    await db.delete(quiz_questions).where(eq(quiz_questions.quiz_id, quizId))

    // 2️⃣ Eliminar el quiz
    await db.delete(quizzes).where(eq(quizzes.id, quizId))

    return c.json({ message: 'Quiz eliminado con éxito' })
  })

// import { db } from '../../index'
// import { quizzes, quiz_questions, subjects, semesters } from '../db/schema'
// import { zValidator } from '@hono/zod-validator'
// import { eq, sql } from 'drizzle-orm'
// import { Hono } from 'hono'
// import { z } from 'zod'

// const createQuizSchema = z.object({
//   id: z.string().min(1),
//   name: z.string().min(1),
//   class: z.string().min(1),
//   subject_id: z.number().int().positive(),
//   questions: z
//     .array(
//       z.object({
//         id: z.number().int().nonnegative(),
//         question: z.string().min(1),
//         options: z.array(z.string().min(1)).min(2),
//         correctAnswer: z.number().int().nonnegative(),
//       }),
//     )
//     .min(1),
// })

// export const quizzesRoute = new Hono()
//   .get('/user/:userId', async (c) => {
//     const userId = Number(c.req.param('userId'))
//     if (isNaN(userId)) return c.json({ error: 'Invalid user ID' }, 400)

//     // 1️⃣ Obtener todos los quizzes del usuario (vía semesters → subjects → quizzes)
//     const quizzesData = await db
//       .select({
//         quiz_id: quizzes.id,
//         quiz_name: quizzes.name,
//         quiz_class: quizzes.class,
//         quiz_source: quizzes.source,
//         subject_id: subjects.id,
//         subject_name: subjects.name,
//       })
//       .from(quizzes)
//       .leftJoin(subjects, eq(quizzes.subject_id, subjects.id))
//       .leftJoin(semesters, eq(subjects.semester_id, semesters.id))
//       .where(eq(semesters.user_id, userId))

//     if (quizzesData.length === 0) {
//       return c.json({ message: 'No quizzes found for this user' }, 404)
//     }

//     // 2️⃣ Obtener todas las preguntas relacionadas con esos quizzes
//     const quizIds = quizzesData.map((q) => q.quiz_id)

//     const questionsData = await db
//       .select()
//       .from(quiz_questions)
//       .where(sql`${quiz_questions.quiz_id} IN (${sql.join(quizIds, sql`,`)})`)

//     // 3️⃣ Formatear las preguntas con JSON.parse en options
//     const formattedQuestions = questionsData.map((q) => ({
//       ...q,
//       options: q.options ? JSON.parse(q.options) : [],
//     }))

//     // 4️⃣ Agrupar preguntas por quiz
//     const quizzesWithQuestions = quizzesData.map((quiz) => ({
//       quiz: {
//         id: quiz.quiz_id,
//         name: quiz.quiz_name,
//         class: quiz.quiz_class,
//         source: quiz.quiz_source,
//         subject: {
//           id: quiz.subject_id,
//           name: quiz.subject_name,
//         },
//       },
//       questions: formattedQuestions.filter((q) => q.quiz_id === quiz.quiz_id),
//     }))

//     // 5️⃣ Responder
//     return c.json({
//       user_id: userId,
//       total_quizzes: quizzesWithQuestions.length,
//       quizzes: quizzesWithQuestions,
//     })
//   })
//   .get('/subject/:subjectId', async (c) => {
//     // Get quizzes by subject ID
//     const subjectId = Number(c.req.param('subjectId'))
//     if (isNaN(subjectId)) return c.json({ error: 'Invalid subject ID' }, 400)

//     const subjectQuizzes = await db
//       .select()
//       .from(quizzes)
//       .where(eq(quizzes.subject_id, subjectId))

//     if (subjectQuizzes.length === 0)
//       return c.json({ message: 'No quizzes found for this subject' }, 404)

//     return c.json(subjectQuizzes)
//   })
//   .get('/:quizId/questions', async (c) => {
//     const quizId = Number(c.req.param('quizId'))
//     if (isNaN(quizId)) return c.json({ error: 'Invalid quiz ID' }, 400)

//     // 1️⃣ Obtener información del quiz
//     const [quizInfo] = await db
//       .select()
//       .from(quizzes)
//       .where(eq(quizzes.id, quizId))

//     if (!quizInfo) {
//       return c.json({ error: 'Quiz not found' }, 404)
//     }

//     // 2️⃣ Obtener preguntas del quiz
//     const questions = await db
//       .select()
//       .from(quiz_questions)
//       .where(eq(quiz_questions.quiz_id, quizId))

//     const formattedQuestions = questions.map((q) => ({
//       ...q,
//       options: q.options ? JSON.parse(q.options) : [],
//     }))

//     // 3️⃣ Retornar quiz + subject_id + preguntas
//     return c.json({
//       quiz: {
//         id: quizInfo.id,
//         name: quizInfo.name,
//         class: quizInfo.class,
//         subject_id: quizInfo.subject_id,
//       },
//       questions: formattedQuestions,
//     })
//   })
//   .post('/', zValidator('json', createQuizSchema), async (c) => {
//     const quizData = await c.req.valid('json')

//     // 1️⃣ Insertar quiz principal
//     const [createdQuiz] = await db
//       .insert(quizzes)
//       .values({
//         subject_id: quizData.subject_id,
//         name: quizData.name,
//         class: quizData.class,
//         source: 'notes',
//       })
//       .returning()

//     if (!createdQuiz) {
//       return c.json({ error: 'Error creating quiz' }, 500)
//     }

//     // 2️⃣ Crear preguntas
//     const questionRecords = quizData.questions.map((q) => ({
//       quiz_id: createdQuiz.id,
//       type: 'multiple_choice' as const,
//       question_text: q.question,
//       options: JSON.stringify(q.options),
//       correct_answer: q.options[q.correctAnswer] ?? '',
//       user_answer: null,
//       feedback_ai: null,
//     }))

//     // 3️⃣ Insertar preguntas relacionadas
//     const insertedQuestions = await db
//       .insert(quiz_questions)
//       .values(questionRecords)
//       .returning()

//     return c.json({
//       message: 'Quiz creado con éxito',
//       quiz: {
//         ...createdQuiz,
//         total_questions: insertedQuestions.length,
//       },
//     })
//   })
//   .delete('/:quizId', async (c) => {
//     const quizId = Number(c.req.param('quizId'))
//     if (isNaN(quizId)) return c.json({ error: 'Invalid quiz ID' }, 400)

//     // Verificar si el quiz existe
//     const existingQuiz = await db
//       .select()
//       .from(quizzes)
//       .where(eq(quizzes.id, quizId))

//     if (existingQuiz.length === 0) {
//       return c.json({ error: 'Quiz not found' }, 404)
//     }

//     // 1️⃣ Eliminar preguntas asociadas al quiz
//     await db.delete(quiz_questions).where(eq(quiz_questions.quiz_id, quizId))

//     // 2️⃣ Eliminar el quiz
//     await db.delete(quizzes).where(eq(quizzes.id, quizId))

//     return c.json({ message: 'Quiz eliminado con éxito' })
//   })
