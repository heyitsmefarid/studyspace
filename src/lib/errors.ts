export class AppError extends Error {
  constructor(message: string, public code?: string, public override cause?: unknown) {
    super(message);
    this.name = 'AppError';
  }
}

type Errorish = { code?: string; message?: string; status?: number };

export function friendlyMessage(err: unknown): string {
  if (err instanceof AppError) return err.message;
  if (err instanceof TypeError && /fetch|network/i.test(err.message)) return "Can't reach StudySpace — check your connection.";
  if (typeof err !== 'object' || err === null) return 'Something went wrong. Please try again.';
  const { code, message = '' } = err as Errorish;
  if (message.startsWith('StudySpace is private')) return message;
  if (code === '23505') return 'That already exists.';
  if (code === '42501' || /row-level security|permission denied/i.test(message)) return "You don't have permission to do that.";
  if (code === '23514' || code === '22001') return 'Some of that input is too long or not allowed.';
  if (code === 'PGRST116') return 'Not found.';
  if (/invalid login credentials/i.test(message)) return 'Wrong email or password.';
  if (/failed to fetch|networkerror/i.test(message)) return "Can't reach StudySpace — check your connection.";
  return 'Something went wrong. Please try again.';
}

interface Res<T> { data: T | null; error: Errorish | null }

export function unwrap<T>(res: Res<T>): T {
  if (res.error) throw new AppError(friendlyMessage(res.error), res.error.code, res.error);
  if (res.data === null) throw new AppError('Not found.', 'PGRST116');
  return res.data;
}

export function unwrapMaybe<T>(res: Res<T>): T | null {
  if (res.error) throw new AppError(friendlyMessage(res.error), res.error.code, res.error);
  return res.data;
}

export function assertOk(res: { error: Errorish | null }): void {
  if (res.error) throw new AppError(friendlyMessage(res.error), res.error.code, res.error);
}
