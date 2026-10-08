import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useOrbit } from '@/features/space/useOrbit';
import { useOurRoom } from '@/features/realtime/RealtimeProvider';
import { useStudySession } from './useStudySession';
import { useTimer } from './useTimer';
import { timerReducer, totalFocusMs } from './timer';
import { SessionSetup, type SetupChoices } from './SessionSetup';
import { SessionRunner } from './SessionRunner';
import { SessionSummary } from './SessionSummary';
import { toFinished, type FinishedStudy } from './finish';

export default function StudyPage() {
  const [params] = useSearchParams();
  const { active, start, dispatch, count, clear } = useStudySession();
  const [lastChoices, setLastChoices] = useState<SetupChoices | undefined>();
  // Holds the summary after the store is cleared; before that it is derived from the finished timer (also after a reload).
  const [saved, setSaved] = useState<FinishedStudy | null>(null);
  const running = Boolean(active && !active.timer.finished);
  const now = useTimer(dispatch, running);
  const orbitParam = params.get('orbit');
  const { orbit } = useOrbit();
  const room = useOurRoom().data ?? null;
  // Joining (or starting) a shared orbit opens a session whose timer follows it.
  useEffect(() => {
    if (!orbitParam || active || saved || !room || !orbit || orbit.id !== orbitParam || orbit.status === 'ended') return;
    start({
      config: { mode: 'custom', focusMin: 25, shortMin: 5, longMin: 15, longEvery: 4, customMin: Math.max(1, Math.ceil(orbit.durationMs / 60_000)) },
      subjectId: null, taskId: null, taskDate: null, content: null, roomId: room, orbitId: orbit.id,
    });
  }, [orbitParam, active, saved, room, orbit, start]);

  const finish = () => {
    if (!active) return;
    const t = Date.now();
    const focus = totalFocusMs(timerReducer(active.timer, { type: 'finish', now: t }), t);
    if (focus < 60_000) {
      toast("Sessions under a minute aren't saved — no star this time.");
      clear();
      return;
    }
    dispatch({ type: 'finish', now: t });
  };

  const done = saved ?? (active?.timer.finished ? toFinished(active) : null);
  if (done) {
    return (
      <SessionSummary
        key={done.sessionId}
        data={done}
        onSaved={(d) => { setSaved(d); clear(); }}
        onAgain={() => setSaved(null)}
        onDiscard={() => { clear(); setSaved(null); }}
      />
    );
  }
  if (active) return <SessionRunner active={active} now={now} dispatch={dispatch} count={count} onFinish={finish} />;
  return (
    <>
      {orbitParam && <p className="mb-3 rounded-xl bg-primary-soft px-3 py-2 text-sm text-primary">Looking for the shared orbit… If it has ended, start your own session below.</p>}
      <SessionSetup
        taskId={params.get('task')}
        initial={lastChoices}
        onStart={(s, choices) => { setLastChoices(choices); start(s); }}
      />
    </>
  );
}
