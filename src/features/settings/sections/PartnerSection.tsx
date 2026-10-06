import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { assertOk, unwrapMaybe } from '@/lib/errors';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Avatar } from '@/components/sky/Avatar';
import { useAuth } from '@/features/auth/AuthProvider';

export function PartnerSection() {
  const { partner } = useAuth();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const pending = useQuery({
    queryKey: ['pending-invite'],
    enabled: !partner,
    queryFn: async () => unwrapMaybe(await supabase.rpc('pending_invite')),
  });
  const invite = useMutation({
    mutationFn: async (e: string) => assertOk(await supabase.rpc('invite_partner', { p_email: e })),
    onSuccess: () => { setEmail(''); toast.success('Invite saved ✦'); void qc.invalidateQueries({ queryKey: ['pending-invite'] }); },
  });
  const signupUrl = `${location.origin}/signup`;

  if (partner) {
    return (
      <div className="flex items-center gap-4">
        <Avatar profile={partner} size={56} />
        <div>
          <p className="font-display text-lg">{partner.display_name || 'Your partner'}</p>
          <p className="text-sm text-ink-muted">Your sky is complete — StudySpace has both of its members.</p>
        </div>
      </div>
    );
  }

  const onSubmit = (e: FormEvent) => { e.preventDefault(); if (email.trim()) invite.mutate(email.trim()); };

  return (
    <div className="flex max-w-md flex-col gap-4">
      <p className="text-sm text-ink-muted">
        Invite the one other person who shares this sky. Only the email you enter here can create the second account.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Partner's email" className="flex-1">
          {(id) => <Input id={id} type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Button type="submit" loading={invite.isPending} disabled={!email.trim()}>Invite</Button>
      </form>
      {pending.data && (
        <div className="rounded-xl border border-line bg-surface-2 p-3 text-sm">
          <p>Invited: <strong>{pending.data}</strong></p>
          <p className="mt-1 text-ink-muted">Send them this link to create their account:</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-surface px-2 py-1">{signupUrl}</code>
            <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(signupUrl).then(() => toast.success('Link copied'))}>
              <Copy className="size-4" /> Copy
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
