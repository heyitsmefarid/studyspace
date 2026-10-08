import { Link, useNavigate, useParams } from 'react-router';
import { Bell, ChevronLeft, ChevronRight, Heart, KeyRound, LogOut, Palette, Shield, Sparkles, Tags, Timer, UserRound, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/AuthProvider';
import { ProfileSection } from './sections/ProfileSection';
import { SubjectsSection } from './sections/SubjectsSection';
import { PasswordSection } from './sections/PasswordSection';
import { AppearanceSection } from './sections/AppearanceSection';
import { NotificationsSection } from './sections/NotificationsSection';
import { PrivacySection } from './sections/PrivacySection';
import { StudySection } from './sections/StudySection';
import { AiSection } from './sections/AiSection';
import { PartnerSection } from './sections/PartnerSection';

const SECTIONS: { id: string; label: string; icon: LucideIcon; render: () => React.ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: UserRound, render: () => <ProfileSection /> },
  { id: 'partner', label: 'Partner', icon: Heart, render: () => <PartnerSection /> },
  { id: 'subjects', label: 'Subjects', icon: Tags, render: () => <SubjectsSection /> },
  { id: 'password', label: 'Password', icon: KeyRound, render: () => <PasswordSection /> },
  { id: 'appearance', label: 'Appearance', icon: Palette, render: () => <AppearanceSection /> },
  { id: 'notifications', label: 'Notifications', icon: Bell, render: () => <NotificationsSection /> },
  { id: 'privacy', label: 'Privacy', icon: Shield, render: () => <PrivacySection /> },
  { id: 'study', label: 'Study', icon: Timer, render: () => <StudySection /> },
  { id: 'nova', label: 'Nova', icon: Sparkles, render: () => <AiSection /> },
];

export default function SettingsPage() {
  const { section } = useParams();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const active = SECTIONS.find((s) => s.id === section);
  const logout = async () => { await signOut(); navigate('/login', { replace: true }); };

  const list = (
    <nav aria-label="Settings sections" className="stagger flex flex-col gap-1 [--stagger-step:30ms]">
      {SECTIONS.map(({ id, label, icon: Icon }) => (
        <Link key={id} to={`/settings/${id}`}
          className={cn('flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors duration-200',
            active?.id === id ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-2 hover:text-ink')}>
          <Icon className="size-4" aria-hidden /> <span className="flex-1">{label}</span>
          <ChevronRight className="size-4 md:hidden" aria-hidden />
        </Link>
      ))}
      <button onClick={logout} className="mt-2 flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-coral hover:bg-coral-soft">
        <LogOut className="size-4" aria-hidden /> Log out
      </button>
    </nav>
  );

  return (
    <div>
      <PageHeader title="Settings" />
      <div className="md:grid md:grid-cols-[220px_1fr] md:gap-8">
        <div className={cn(active && 'hidden md:block')}>{list}</div>
        <div className={cn(!active && 'hidden md:block')}>
          {active ? (
            <Card key={active.id} className="animate-rise-in">
              <Link to="/settings" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted md:hidden"><ChevronLeft className="size-4" /> Settings</Link>
              <h2 className="mb-4 font-display text-xl">{active.label}</h2>
              {active.render()}
            </Card>
          ) : (
            <Card className="hidden md:block"><p className="text-ink-muted">Pick a section on the left.</p><Button variant="ghost" className="mt-2" onClick={() => navigate('/settings/profile')}>Edit profile</Button></Card>
          )}
        </div>
      </div>
    </div>
  );
}
