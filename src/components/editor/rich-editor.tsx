'use client'

import { Extension, type JSONContent } from '@tiptap/core'
import { Highlight } from '@tiptap/extension-highlight'
import { TextAlign } from '@tiptap/extension-text-align'
import { Color, FontSize, TextStyle } from '@tiptap/extension-text-style'
import { Placeholder } from '@tiptap/extensions'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useRef, useState, type ChangeEvent } from 'react'
import { COLORS, FONT_SIZES, HIGHLIGHTS } from '@/blocks'
import { ACCEPT, parseEmbed, uploadMedia } from '@/lib/upload'
import { EmbedNode, MediaNode } from './rich-nodes'

const FONT_CSS: Record<string, string> = { display: 'var(--display)', sans: 'var(--sans)', serif: "Georgia, 'Times New Roman', serif" }

/** Font choice stored as a key ("display", "sans", "serif"), shown with the matching site font. */
const FontKey = Extension.create({
  name: 'fontKey',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontFamily: {
            default: null,
            parseHTML: (el) => (el as HTMLElement).dataset.font ?? null,
            renderHTML: (attrs) =>
              attrs.fontFamily && FONT_CSS[attrs.fontFamily as string]
                ? { 'data-font': attrs.fontFamily, style: `font-family: ${FONT_CSS[attrs.fontFamily as string]}` }
                : {},
          },
        },
      },
    ]
  },
})

const EMOJI = '😀 😁 😂 🤣 😊 😍 🤩 😎 🤔 🙄 😬 😴 😮 😱 🥲 😅 🙌 👏 👍 👎 👌 🤝 🙏 💪 👀 🔥 ✨ ⭐ 🌟 💯 ✅ ❌ ⚠️ ❗ ❓ 💡 🎯 🏆 🥇 🥈 🥉 🎉 🎁 💰 💸 🪙 💎 ⌚ ⏱️ ⏰ 🕰️ ⏳ 📈 📉 📊 🧭 🔍 🛒 🏷️ 💳 📦 🚚 🇮🇳 🇨🇭 🇯🇵 🇩🇪 🇺🇸 🇬🇧 🏁 🏎️ 🤿 ✈️ 🏔️ 🌊 ❤️ 🧡 💛 💚 💙 🖤 🤍 ➡️ ⬅️ ⬆️ ⬇️ ↗️ 🔗 📷 🎥 📝 📌'.split(' ')

interface Props {
  initial: JSONContent
  onChange: (doc: JSONContent) => void
  onUploaded?: (mediaId: string, path: string, kind: 'image' | 'video') => void
  placeholder?: string
}

function ToolbarButton({ on, label, onClick, children, disabled }: { on?: boolean; label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" className="tf-ed-btn" aria-label={label} title={label} aria-pressed={on ? 'true' : 'false'} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {children}
    </button>
  )
}

function Toolbar({ editor, onFiles, busy }: { editor: Editor; onFiles: (files: File[]) => void; busy: boolean }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [panel, setPanel] = useState<'' | 'emoji' | 'color' | 'link' | 'embed'>('')
  const [linkValue, setLinkValue] = useState('')
  const [embedValue, setEmbedValue] = useState('')
  const [embedError, setEmbedError] = useState('')

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: e.isActive('heading', { level: 2 }) ? 'h2' : e.isActive('heading', { level: 3 }) ? 'h3' : e.isActive('heading', { level: 4 }) ? 'h4' : 'p',
      size: (e.getAttributes('textStyle').fontSize as string | undefined) ?? '',
      font: (e.getAttributes('textStyle').fontFamily as string | undefined) ?? '',
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      link: e.isActive('link'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      align: (['center', 'right', 'justify'] as const).find((a) => e.isActive({ textAlign: a })) ?? 'left',
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })

  const chain = () => editor.chain().focus()
  /** Dropdowns keep keyboard focus after a choice; hand it back to the text so typing continues there. */
  const refocus = () => requestAnimationFrame(() => editor.commands.focus())

  function setBlock(value: string) {
    if (value === 'p') chain().setParagraph().run()
    else chain().setHeading({ level: Number(value.slice(1)) as 2 | 3 | 4 }).run()
    refocus()
  }

  function applyLink() {
    const href = linkValue.trim()
    if (!href) chain().extendMarkRange('link').unsetLink().run()
    else if (/^(https:\/\/|mailto:|\/(?!\/))/.test(href)) chain().extendMarkRange('link').setLink({ href }).run()
    else if (/^[\w.-]+\.[a-z]{2,}/i.test(href)) chain().extendMarkRange('link').setLink({ href: `https://${href}` }).run()
    setPanel('')
  }

  function applyEmbed() {
    const parsed = parseEmbed(embedValue)
    if (!parsed) {
      setEmbedError('Paste a YouTube link or an Instagram post/Reel link.')
      return
    }
    chain().insertContent({ type: 'embed', attrs: parsed }).run()
    setEmbedValue('')
    setEmbedError('')
    setPanel('')
  }

  return (
    <div className="tf-ed-toolbar" role="toolbar" aria-label="Formatting">
      <div className="tf-ed-group">
        <select className="tf-ed-select" aria-label="Text type" value={s.block} onChange={(e) => setBlock(e.target.value)}>
          <option value="p">Paragraph</option>
          <option value="h2">Big heading</option>
          <option value="h3">Heading</option>
          <option value="h4">Small heading</option>
        </select>
        <select
          className="tf-ed-select"
          aria-label="Font size"
          value={s.size}
          onChange={(e) => {
            if (e.target.value) chain().setFontSize(e.target.value).run()
            else chain().unsetFontSize().run()
            refocus()
          }}
        >
          <option value="">Size</option>
          {FONT_SIZES.map((f) => (
            <option key={f} value={f}>
              {f.replace('px', '')}
            </option>
          ))}
        </select>
        <select
          className="tf-ed-select"
          aria-label="Font"
          value={s.font}
          onChange={(e) => {
            chain()
              .setMark('textStyle', { fontFamily: e.target.value || null })
              .removeEmptyTextStyle()
              .run()
            refocus()
          }}
        >
          <option value="">Font</option>
          <option value="sans">Inter</option>
          <option value="display">Anton (headline)</option>
          <option value="serif">Serif</option>
        </select>
      </div>

      <div className="tf-ed-group">
        <ToolbarButton label="Bold" on={s.bold} onClick={() => chain().toggleBold().run()}>
          <b>B</b>
        </ToolbarButton>
        <ToolbarButton label="Italic" on={s.italic} onClick={() => chain().toggleItalic().run()}>
          <i>I</i>
        </ToolbarButton>
        <ToolbarButton label="Underline" on={s.underline} onClick={() => chain().toggleUnderline().run()}>
          <u>U</u>
        </ToolbarButton>
        <ToolbarButton label="Strikethrough" on={s.strike} onClick={() => chain().toggleStrike().run()}>
          <s>S</s>
        </ToolbarButton>
        <ToolbarButton label="Text colour" on={panel === 'color'} onClick={() => setPanel(panel === 'color' ? '' : 'color')}>
          <span style={{ borderBottom: '3px solid var(--gold)' }}>A</span>
        </ToolbarButton>
        <ToolbarButton
          label="Link"
          on={s.link || panel === 'link'}
          onClick={() => {
            setLinkValue((editor.getAttributes('link').href as string | undefined) ?? '')
            setPanel(panel === 'link' ? '' : 'link')
          }}
        >
          🔗
        </ToolbarButton>
      </div>

      <div className="tf-ed-group">
        <ToolbarButton label="Bulleted list" on={s.bullet} onClick={() => chain().toggleBulletList().run()}>
          •≡
        </ToolbarButton>
        <ToolbarButton label="Numbered list" on={s.ordered} onClick={() => chain().toggleOrderedList().run()}>
          1.
        </ToolbarButton>
        <ToolbarButton label="Quote" on={s.quote} onClick={() => chain().toggleBlockquote().run()}>
          ❝
        </ToolbarButton>
        <ToolbarButton label="Divider" onClick={() => chain().setHorizontalRule().run()}>
          —
        </ToolbarButton>
        <select className="tf-ed-select" aria-label="Alignment" value={s.align} onChange={(e) => {
            chain().setTextAlign(e.target.value).run()
            refocus()
          }}>
          <option value="left">Left</option>
          <option value="center">Centre</option>
          <option value="right">Right</option>
          <option value="justify">Justify</option>
        </select>
      </div>

      <div className="tf-ed-group">
        <ToolbarButton label="Emoji" on={panel === 'emoji'} onClick={() => setPanel(panel === 'emoji' ? '' : 'emoji')}>
          😊
        </ToolbarButton>
        <ToolbarButton label="Add image, GIF or video" disabled={busy} onClick={() => fileInput.current?.click()}>
          {busy ? '…' : '🖼️'}
        </ToolbarButton>
        <ToolbarButton label="Embed YouTube or Instagram" on={panel === 'embed'} onClick={() => setPanel(panel === 'embed' ? '' : 'embed')}>
          ▶
        </ToolbarButton>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const files = [...(e.target.files ?? [])]
            e.target.value = ''
            if (files.length) onFiles(files)
          }}
        />
      </div>

      <div className="tf-ed-group">
        <ToolbarButton label="Undo" disabled={!s.canUndo} onClick={() => chain().undo().run()}>
          ↶
        </ToolbarButton>
        <ToolbarButton label="Redo" disabled={!s.canRedo} onClick={() => chain().redo().run()}>
          ↷
        </ToolbarButton>
        <ToolbarButton label="Clear formatting" onClick={() => chain().unsetAllMarks().clearNodes().run()}>
          ⌫
        </ToolbarButton>
      </div>

      {panel === 'emoji' ? (
        <div className="tf-ed-panel tf-ed-emoji">
          {EMOJI.map((em) => (
            <button key={em} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => chain().insertContent(em).run()}>
              {em}
            </button>
          ))}
          <p className="tf-note" style={{ fontSize: 12, width: '100%', margin: '6px 0 0' }}>
            Any emoji works: on a Mac press Ctrl + Cmd + Space, on Windows press Win + .
          </p>
        </div>
      ) : null}
      {panel === 'color' ? (
        <div className="tf-ed-panel">
          <span className="tf-label">Text</span>
          {COLORS.map((c) => (
            <button key={c} type="button" className="tf-ed-swatch" style={{ background: c }} aria-label={`Text colour ${c}`} onMouseDown={(e) => e.preventDefault()} onClick={() => chain().setColor(c).run()} />
          ))}
          <button type="button" className="tf-ghost tf-small" onClick={() => chain().unsetColor().run()}>
            Default
          </button>
          <span className="tf-label" style={{ marginLeft: 12 }}>
            Highlight
          </span>
          {HIGHLIGHTS.map((c) => (
            <button key={c} type="button" className="tf-ed-swatch" style={{ background: c }} aria-label={`Highlight ${c}`} onMouseDown={(e) => e.preventDefault()} onClick={() => chain().toggleHighlight({ color: c }).run()} />
          ))}
          <button type="button" className="tf-ghost tf-small" onClick={() => chain().unsetHighlight().run()}>
            None
          </button>
        </div>
      ) : null}
      {panel === 'link' ? (
        <form
          className="tf-ed-panel"
          onSubmit={(e) => {
            e.preventDefault()
            applyLink()
          }}
        >
          <input className="tf-field" autoFocus placeholder="https://… (leave empty to remove the link)" value={linkValue} onChange={(e) => setLinkValue(e.target.value)} style={{ flex: '1 1 280px' }} />
          <button type="submit" className="tf-gold tf-small">
            Apply
          </button>
        </form>
      ) : null}
      {panel === 'embed' ? (
        <form
          className="tf-ed-panel"
          onSubmit={(e) => {
            e.preventDefault()
            applyEmbed()
          }}
        >
          <input className="tf-field" autoFocus placeholder="Paste a YouTube or Instagram link" value={embedValue} onChange={(e) => setEmbedValue(e.target.value)} style={{ flex: '1 1 280px' }} />
          <button type="submit" className="tf-gold tf-small">
            Embed
          </button>
          {embedError ? (
            <span role="alert" style={{ color: 'var(--warn)', fontSize: 13, width: '100%' }}>
              {embedError}
            </span>
          ) : null}
        </form>
      ) : null}
    </div>
  )
}

/**
 * The rich text editor used in the post editor. Paste or drop screenshots, images, GIFs and short videos straight in;
 * they upload to the site's storage and appear in place.
 */
export function RichEditor({ initial, onChange, onUploaded, placeholder = 'Write here. Paste or drop images, GIFs and videos straight in.' }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const editorRef = useRef<Editor | null>(null)

  async function insertFiles(files: File[], pos?: number) {
    const editor = editorRef.current
    if (!editor) return
    setBusy(true)
    setError('')
    try {
      for (const file of files) {
        const media = await uploadMedia(file)
        onUploaded?.(media.mediaId, media.path, media.kind)
        const content = { type: 'media', attrs: { ...media, caption: '' } }
        if (pos !== undefined) editor.chain().focus().insertContentAt(pos, content).run()
        else editor.chain().focus().insertContent(content).run()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setBusy(false)
    }
  }

  const editor = useEditor({
    immediatelyRender: false,
    injectCSS: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        code: false,
        codeBlock: false,
        link: { openOnClick: false, autolink: true, protocols: ['https', 'mailto'], defaultProtocol: 'https' },
      }),
      TextStyle,
      FontSize,
      Color,
      FontKey,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
      MediaNode,
      EmbedNode,
    ],
    content: initial,
    editorProps: {
      attributes: { class: 'tf-rich tf-ed-content', 'aria-label': 'Post text', role: 'textbox', 'aria-multiline': 'true' },
      // Pasted HTML keeps its words and structure; its inline styles and classes are dropped.
      transformPastedHTML: (html) => html.replace(/\s(style|class|id)="[^"]*"/gi, ''),
      handlePaste: (_view, event) => {
        const files = [...(event.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'))
        if (!files.length) return false
        event.preventDefault()
        void insertFiles(files)
        return true
      },
      handleDrop: (view, event) => {
        const files = [...(event.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'))
        if (!files.length) return false
        event.preventDefault()
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
        void insertFiles(files, pos)
        return true
      },
    },
    onCreate: ({ editor: e }) => {
      editorRef.current = e
    },
    onUpdate: ({ editor: e }) => onChange(e.getJSON()),
  })

  if (!editor) return <div className="tf-ed" style={{ minHeight: 220 }} />

  return (
    <div className="tf-ed">
      <Toolbar editor={editor} busy={busy} onFiles={(files) => void insertFiles(files)} />
      {error ? (
        <div className="tf-alert" role="alert" style={{ margin: '0 12px' }}>
          {error}
        </div>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  )
}
