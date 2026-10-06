import Image from '@tiptap/extension-image';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { useSignedUrl } from '@/lib/storage';
import { Skeleton } from '@/components/ui/Skeleton';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    storageImage: { insertStorageImage: (attrs: { path: string; alt?: string }) => ReturnType };
  }
}

function StorageImageView({ node }: NodeViewProps) {
  const url = useSignedUrl('note-files', node.attrs.path as string | null);
  return (
    <NodeViewWrapper as="figure" className="my-3">
      {url ? <img src={url} alt={(node.attrs.alt as string) ?? ''} className="max-w-full rounded-xl" />
           : node.attrs.path ? <Skeleton className="h-48 w-full" /> : <p className="text-sm text-ink-faint">Image unavailable</p>}
    </NodeViewWrapper>
  );
}

export const StorageImage = Image.extend({
  name: 'storageImage',
  addAttributes() {
    return {
      ...this.parent?.(),
      path: { default: null, parseHTML: (el) => el.getAttribute('data-path'), renderHTML: (a) => ({ 'data-path': a.path }) },
    };
  },
  addNodeView() { return ReactNodeViewRenderer(StorageImageView); },
  addCommands() {
    return {
      ...this.parent?.(),
      insertStorageImage: (attrs) => ({ commands }) => commands.insertContent({ type: this.name, attrs: { ...attrs, src: '' } }),
    };
  },
});
