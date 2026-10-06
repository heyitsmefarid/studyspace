import StarterKit from '@tiptap/starter-kit';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import Highlight from '@tiptap/extension-highlight';
import { Placeholder } from '@tiptap/extensions';
import { StorageImage } from './StorageImage';
import { SlashCommand } from './SlashCommand';

export function noteExtensions({ editable }: { editable: boolean }) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: !editable, autolink: true, protocols: ['http', 'https', 'mailto'] },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Highlight,
    Placeholder.configure({ placeholder: 'Start writing… type / for blocks' }),
    StorageImage,
    ...(editable ? [SlashCommand] : []),
  ];
}
