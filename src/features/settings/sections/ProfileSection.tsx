import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Avatar } from '@/components/sky/Avatar';
import { objectPath, removeFile, uploadFile } from '@/lib/storage';
import { friendlyMessage } from '@/lib/errors';
import { useAuth } from '@/features/auth/AuthProvider';
import { useUpdateProfile } from '@/features/auth/useProfileMutations';
import { ColorSwatches } from '@/features/subjects/SubjectPicker';
import { SUBJECT_COLORS } from '@/features/subjects/colors';

const STAR_COLORS = ['#7CC4FF', '#FF9ECF', ...SUBJECT_COLORS];

export function ProfileSection() {
  const { profile, user } = useAuth();
  const update = useUpdateProfile();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [color, setColor] = useState(profile?.star_color ?? STAR_COLORS[0]!);
  const [tz, setTz] = useState(profile?.timezone ?? 'Asia/Manila');
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const zones = useMemo(() => {
    try { return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone'); } catch { return [tz]; }
  }, [tz]);

  async function onAvatar(file: File | undefined) {
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) return toast.error('Choose an image.');
    if (file.size > 2 * 1024 * 1024) return toast.error('Avatars must be 2 MB or smaller.');
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
      const path = objectPath(user.id, `avatar-${Date.now()}.${ext}`);
      await uploadFile('avatars', path, file);
      const old = profile?.avatar_path;
      await update.mutateAsync({ avatar_path: path });
      if (old) removeFile('avatars', old).catch(() => undefined);
      toast.success('Avatar updated');
    } catch (err) {
      toast.error(friendlyMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    await update.mutateAsync({ display_name: name.trim(), bio: bio.trim(), star_color: color, timezone: tz });
    toast.success('Profile saved');
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <Avatar profile={profile} size={64} />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onAvatar(e.target.files?.[0])} />
        <Button variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()}>Change avatar</Button>
      </div>
      <Field label="Name">{(id) => <Input id={id} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
      <Field label="Bio" hint={`${bio.length}/280`}>{(id) => <Textarea id={id} maxLength={280} value={bio} onChange={(e) => setBio(e.target.value)} />}</Field>
      <div><p className="mb-2 text-sm font-medium">Star colour</p><ColorSwatches value={color} onChange={setColor} colors={STAR_COLORS} /></div>
      <Field label="Timezone">{(id) => <Select id={id} value={tz} onChange={(e) => setTz(e.target.value)}>{zones.map((z) => <option key={z}>{z}</option>)}</Select>}</Field>
      <Button onClick={save} loading={update.isPending} done={saved} disabled={!name.trim()} className="self-start">Save profile</Button>
    </div>
  );
}
