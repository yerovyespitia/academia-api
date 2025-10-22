import { conceptMapsRoute } from './src/routes/concept-maps'
import { documentsRoute } from './src/routes/documents'
import { glossaryRoute } from './src/routes/glossary'
import { gradesRoute } from './src/routes/grades'
import { notesRoute } from './src/routes/notes'
import { quizzesRoute } from './src/routes/quizzes'
import { semestersRoute } from './src/routes/semesters'
import { subjectsRoute } from './src/routes/subjects'
import { usersRoute } from './src/routes/users'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

const app = new Hono()

app.use('*', logger())

app.use(
  '/api/*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 3600,
    credentials: false,
  }),
)

app
  .basePath('/api')
  .route('/users', usersRoute)
  .route('/semesters', semestersRoute)
  .route('/subjects', subjectsRoute)
  .route('/grades', gradesRoute)
  .route('/documents', documentsRoute)
  .route('/notes', notesRoute)
  .route('/quizzes', quizzesRoute)
  .route('/glossary', glossaryRoute)
  .route('/concept-maps', conceptMapsRoute)

export default app
