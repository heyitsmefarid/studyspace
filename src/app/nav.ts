import { BarChart3, BookOpenText, CalendarDays, Heart, Home, Layers, ListChecks, MessagesSquare, Settings, Sparkles, Timer, type LucideIcon } from 'lucide-react';

export interface NavItem { to: string; label: string; icon: LucideIcon }

export const NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/notes', label: 'Notes', icon: BookOpenText },
  { to: '/decks', label: 'Flashcards', icon: Layers },
  { to: '/quizzes', label: 'Quizzes', icon: ListChecks },
  { to: '/tutor', label: 'Nova', icon: Sparkles },
  { to: '/planner', label: 'Planner', icon: CalendarDays },
  { to: '/study', label: 'Study', icon: Timer },
  { to: '/stats', label: 'Stats', icon: BarChart3 },
  { to: '/space', label: 'Our Space', icon: Heart },
  { to: '/chat', label: 'Chat', icon: MessagesSquare },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const byPath = (p: string) => NAV.find((n) => n.to === p)!;
export const MOBILE_TABS: NavItem[] = ['/', '/notes', '/study', '/tutor', '/space'].map(byPath);
export const MORE_ITEMS: NavItem[] = NAV.filter((n) => !MOBILE_TABS.includes(n));
