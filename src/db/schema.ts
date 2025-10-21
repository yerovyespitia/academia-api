import { sql } from 'drizzle-orm'
import { integer, text, sqliteTable, real } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').unique().notNull(),
  password_hash: text('password_hash').notNull(),
  entity: text('entity').notNull().default('student'),
  school: text('school').notNull(),
  created_at: text('created_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updated_at: text('updated_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export const semesters = sqliteTable('semesters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  year: integer('year').notNull(), // ejemplo: 2025
  period: text('period').notNull(), // ejemplo: "2025-1"
  created_at: text('created_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updated_at: text('updated_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
})

export const subjects = sqliteTable('subjects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  semester_id: integer('semester_id')
    .notNull()
    .references(() => semesters.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  code: text('code').notNull(),
  credits: integer('credits').notNull(),
  created_at: text('created_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
})

export const grades = sqliteTable('grades', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  subject_id: integer('subject_id')
    .notNull()
    .references(() => subjects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // Ejemplo: "Parcial 1", "Tarea 2"
  weight: real('weight').notNull(), // Porcentaje de peso
  score: real('score'),
  max_score: real('max_score'),
  created_at: text('created_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
})

export const notes = sqliteTable('notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  document_id: integer('document_id'),
  user_id: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  subject_id: integer('subject_id').references(() => subjects.id, {
    onDelete: 'set null',
  }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  format: text('format').$type<'markdown' | 'latex' | 'text'>().notNull(),
  created_at: text('created_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
})

export const documents = sqliteTable('documents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  subject_id: integer('subject_id').references(() => subjects.id, {
    onDelete: 'set null',
  }),
  title: text('title').notNull(),
  type: text('type').$type<'image' | 'pdf' | 'voice' | 'text'>().notNull(),
  file_url: text('file_url').notNull(), // ruta en storage (local o cloud)
  extracted_text: text('extracted_text'), // texto del OCR o voz a texto
  created_at: text('created_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
})

export const quizzes = sqliteTable('quizzes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  subject_id: integer('subject_id')
    .references(() => subjects.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  class: text('class').notNull(),
  source: text('source')
    .$type<'notes' | 'syllabus' | 'uploads' | 'mixed'>()
    .notNull(),
  created_at: text('created_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
})

export const quiz_questions = sqliteTable('quiz_questions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  quiz_id: integer('quiz_id')
    .references(() => quizzes.id, { onDelete: 'cascade' })
    .notNull(),
  type: text('type').$type<'multiple_choice' | 'text'>().notNull(),
  question_text: text('question_text').notNull(),
  options: text('options'), // JSON string para opciones múltiples
  correct_answer: text('correct_answer').notNull(),
  user_answer: text('user_answer'),
  feedback_ai: text('feedback_ai'),
})

export const glossary_terms = sqliteTable('glossary_terms', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  subject_id: integer('subject_id')
    .references(() => subjects.id, { onDelete: 'cascade' })
    .notNull(),
  term: text('term').notNull(),
  definition: text('definition').notNull(),
  source: text('source').$type<'user' | 'ai'>().notNull(),
  created_at: text('created_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
})

export const concept_maps = sqliteTable('concept_maps', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  subject_id: integer('subject_id')
    .references(() => subjects.id, { onDelete: 'cascade' })
    .notNull(),
  data: text('data').notNull(),
  created_at: text('created_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
})
