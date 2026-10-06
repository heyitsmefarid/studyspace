import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useStudySession } from './useStudySession';
import { useTimer } from './useTimer';
import { timerReducer, totalFocusMs } from './timer';
import { SessionSetup, type SetupChoices } from './SessionSetup';
import { SessionRunner } from './SessionRunner';
import { SessionSummary, toFinished, type FinishedStudy } from './SessionSummary';

export default function StudyPage() {
  const [params] = useSearchParams();
  const { active, start, dispatch, count, clear } = useStudySession();
  const [lastChoices, setLastChoices] = useState<SetupChoices | undefined>();
  // Holds the summary after the store is cleared; before that it is derived from the finished timer (also after a reload).
  const [saved, setSaved] = useState<FinishedStudy | null>(null);
  const running = Boolean(active && !active.timer.finished);
  const now = useTimer(dispatch, running);

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
        key={done.startedAtIso}
        data={done}
        onSaved={(d) => { setSaved(d); clear(); }}
        onAgain={() => setSaved(null)}
      />
    );
  }
  if (active) return <SessionRunner active={active} now={now} dispatch={dispatch} count={count} onFinish={finish} />;
  return (
    <SessionSetup
      taskId={params.get('task')}
      initial={lastChoices}
      onStart={(s, choices) => { setLastChoices(choices); start(s); }}
    />
  );
}
