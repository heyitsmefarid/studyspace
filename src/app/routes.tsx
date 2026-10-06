import type { ComponentType } from 'react';
import type { RouteObject } from 'react-router';
import { AppShell } from './AppShell';
import { RouteError } from './RouteError';
import { Placeholder } from './Placeholder';
import { RequireAuth } from '@/features/auth/RequireAuth';

const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await load()).default });
const r = (path: string, load: () => Promise<{ default: ComponentType }>) => ({ path, lazy: page(load), errorElement: <RouteError /> });

/** The app's route table (also used by tests to check which navigations share a page). */
export const routes: RouteObject[] = [
  r('/login', () => import('@/features/auth/LoginPage')),
  r('/set-password', () => import('@/features/auth/SetPasswordPage')),
  r('/signup', () => import('@/features/auth/SignUpPage')),
  {
    element: <RequireAuth />,
    errorElement: <RouteError />,
    children: [
      r('/onboarding', () => import('@/features/onboarding/OnboardingPage')),
      {
        element: <AppShell />,
        children: [
          { index: true, lazy: page(() => import('@/features/dashboard/DashboardPage')), errorElement: <RouteError /> },
          r('notes', () => import('@/features/notes/NotesPage')),
          r('notes/:id', () => import('@/features/notes/NoteEditorPage')),
          r('decks', () => import('@/features/flashcards/DecksPage')),
          r('decks/:id', () => import('@/features/flashcards/DeckPage')),
          r('decks/:id/study', () => import('@/features/flashcards/ReviewPage')),
          r('quizzes', () => import('@/features/quizzes/QuizzesPage')),
          r('quizzes/:id', () => import('@/features/quizzes/QuizEditorPage')),
          r('quizzes/:id/take', () => import('@/features/quizzes/TakeQuizPage')),
          r('quiz/take', () => import('@/features/quizzes/TakeQuizPage')),
          r('attempts/:id', () => import('@/features/quizzes/ResultsPage')),
          // One optional-segment route so creating a chat (/tutor → /tutor/:id) keeps the page mounted.
          r('tutor/:conversationId?', () => import('@/features/tutor/TutorPage')),
          r('planner', () => import('@/features/planner/PlannerPage')),
          r('planner/ai', () => import('@/features/planner/AiPlannerPage')),
          r('study', () => import('@/features/study/StudyPage')),
          r('stats', () => import('@/features/stats/StatsPage')),
          r('profile/:userId?', () => import('@/features/profile/ProfilePage')),
          r('settings/:section?', () => import('@/features/settings/SettingsPage')),
          { path: 'space', element: <Placeholder title="Our Space" /> },
          { path: 'chat', element: <Placeholder title="Chat" /> },
          { path: 'market', element: <Placeholder title="Market" /> },
          { path: 'notifications', element: <Placeholder title="Notifications" /> },
          { path: '*', element: <Placeholder title="Lost in space" body="That page doesn't exist." /> },
        ],
      },
    ],
  },
];
