import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { YourSky } from './YourSky';
import { NovaRecommendations } from './NovaRecommendations';
import { WidgetBoundary } from './widgets/WidgetCard';
import { QuickActions } from './widgets/QuickActions';
import { TodayCard } from './widgets/TodayCard';
import { UpcomingCard } from './widgets/UpcomingCard';
import { QuickNova } from './widgets/QuickNova';
import { SubjectProgress } from './widgets/SubjectProgress';
import { RecentDecks } from './widgets/RecentDecks';
import { RecentNotes } from './widgets/RecentNotes';
import { RecentQuizzes } from './widgets/RecentQuizzes';

const Slot = ({ span, children }: { span: string; children: ReactNode }) => (
  <div className={cn('min-w-0', span)}><WidgetBoundary>{children}</WidgetBoundary></div>
);

export default function DashboardPage() {
  return (
    <div className="stagger flex flex-col gap-4 [--stagger-step:50ms] lg:grid lg:grid-cols-12">
      <Slot span="lg:col-span-12"><YourSky /></Slot>
      <Slot span="lg:col-span-12"><QuickActions /></Slot>
      <Slot span="lg:col-span-7"><TodayCard /></Slot>
      <Slot span="lg:col-span-5"><UpcomingCard /></Slot>
      <Slot span="lg:col-span-7"><NovaRecommendations /></Slot>
      <Slot span="lg:col-span-5"><QuickNova /></Slot>
      <Slot span="lg:col-span-12"><SubjectProgress /></Slot>
      <Slot span="lg:col-span-4"><RecentDecks /></Slot>
      <Slot span="lg:col-span-4"><RecentNotes /></Slot>
      <Slot span="lg:col-span-4"><RecentQuizzes /></Slot>
    </div>
  );
}
