import { AppError } from '@/domain/result'

interface DbError {
  code?: string
  message: string
}

/** Translates database errors into errors that are safe to show. Unknown ones are rethrown and logged by the action wrapper. */
export function raise(error: DbError, context: string): never {
  if (error.code === '23505') throw new AppError('conflict', 'That web address or name is already in use.')
  if (error.code === '42501') throw new AppError('forbidden', 'You do not have access to this.')
  if (error.code === '23503') throw new AppError('invalid_input', 'That refers to something that does not exist.')
  if (error.code === '23514' || error.code === '22P02') throw new AppError('invalid_input', 'One of the values is not allowed.')
  throw new Error(`${context}: ${error.message}`)
}
