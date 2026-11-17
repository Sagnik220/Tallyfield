'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import { mediaUrl } from '@/lib/media-url'

/** An uploaded image, GIF or video placed in the text. Stores the media id and storage path, never a full URL. */
function MediaView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const a = node.attrs as { path: string; kind: 'image' | 'video'; alt: string; caption: string; size: 'column' | 'wide' | 'full' | null }
  const src = mediaUrl(a.path)
  return (
    <NodeViewWrapper className="tf-ed-media" data-selected={selected ? 'true' : undefined} data-size={a.size ?? 'column'}>
      <div className="tf-ed-media-handle" data-drag-handle contentEditable={false} title="Drag to move this picture">
        ⠿ Drag to move
      </div>
      <div contentEditable={false}>
        {a.kind === 'video' ? (
          <video src={src} controls playsInline preload="metadata" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- editor preview of an uploaded file
          <img src={src} alt={a.alt} />
        )}
        <div className="tf-ed-media-fields">
          <input className="tf-field" placeholder="Caption (optional)" value={a.caption} maxLength={300} onChange={(e) => updateAttributes({ caption: e.target.value })} />
          <input className="tf-field" placeholder="Describe it for screen readers" value={a.alt} maxLength={300} onChange={(e) => updateAttributes({ alt: e.target.value })} />
          <label className="tf-ed-media-size">
            <span>Size</span>
            <select value={a.size ?? 'column'} onChange={(e) => updateAttributes({ size: e.target.value })}>
              <option value="column">Text width</option>
              <option value="wide">Wide</option>
              <option value="full">Full screen width (best for landscape photos)</option>
            </select>
          </label>
          <button type="button" className="tf-ghost tf-small" onClick={deleteNode}>
            Remove
          </button>
        </div>
      </div>
    </NodeViewWrapper>
  )
}

export const MediaNode = Node.create({
  name: 'media',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      mediaId: { default: null },
      path: { default: null },
      kind: { default: 'image' },
      alt: { default: '' },
      caption: { default: '' },
      width: { default: null },
      height: { default: null },
      size: { default: 'column' },
    }
  },
  parseHTML() {
    return [{ tag: 'figure[data-tf-media]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['figure', mergeAttributes(HTMLAttributes, { 'data-tf-media': '' })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(MediaView)
  },
})

/** A YouTube video or Instagram post, stored as provider + id only. */
function EmbedView({ node, deleteNode, selected }: NodeViewProps) {
  const a = node.attrs as { provider: 'youtube' | 'instagram'; id: string }
  const src = a.provider === 'youtube' ? `https://www.youtube-nocookie.com/embed/${a.id}?rel=0` : `${a.id}embed/`
  return (
    <NodeViewWrapper className="tf-ed-media" data-selected={selected ? 'true' : undefined}>
      <div contentEditable={false}>
        <iframe
          src={src}
          title={a.provider === 'youtube' ? 'YouTube video' : 'Instagram post'}
          style={{ width: '100%', aspectRatio: a.provider === 'youtube' ? '16 / 9' : undefined, height: a.provider === 'youtube' ? undefined : 560, border: 0, background: '#000' }}
        />
        <div className="tf-ed-media-fields">
          <span className="tf-note" style={{ fontSize: 13 }}>
            {a.provider === 'youtube' ? 'YouTube video' : 'Instagram post'}
          </span>
          <button type="button" className="tf-ghost tf-small" onClick={deleteNode}>
            Remove
          </button>
        </div>
      </div>
    </NodeViewWrapper>
  )
}

export const EmbedNode = Node.create({
  name: 'embed',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { provider: { default: 'youtube' }, id: { default: '' } }
  },
  parseHTML() {
    return [{ tag: 'div[data-tf-embed]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-tf-embed': '' })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(EmbedView)
  },
})
