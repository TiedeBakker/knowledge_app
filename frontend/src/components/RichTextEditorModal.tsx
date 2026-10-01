import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import CodeBlock from '@tiptap/extension-code-block';
import {
  Bold, Italic, List, ListOrdered, Heading1, Heading2,
  Quote, ImageIcon, X, Save, Highlighter, Palette,
  Maximize2, Minimize2, Code, FolderOpen
} from 'lucide-react';
import { GetLocalImageBase64, SelectImageFile } from '../../wailsjs/go/main/App';

const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      'data-layout': {
        default: 'inline-center',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-layout'),
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes['data-layout']) return {};
          return { 'data-layout': attributes['data-layout'] };
        },
      },
      'data-zoom': {
        default: '1',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-zoom'),
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes['data-zoom'] || attributes['data-zoom'] === '1') return {};
          return {
            'data-zoom': attributes['data-zoom'],
            style: `transform: scale(${attributes['data-zoom']}); transform-origin: ${attributes['data-position'] || 'center'};`
          };
        },
      },
      'data-position': {
        default: 'center center',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-position'),
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes['data-position']) return {};
          return { 'data-position': attributes['data-position'] };
        },
      },
    };
  },
});

type ImageLayoutType = 'inline-left' | 'inline-right' | 'inline-center' | 'span-all';

interface RichTextEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialValue: string;
  title?: string;
  onSave: (htmlContent: string) => void;
}

export const RichTextEditorModal: React.FC<RichTextEditorModalProps> = ({
  isOpen,
  onClose,
  initialValue,
  title = 'Tekst en Illustraties Bewerken',
  onSave,
}) => {
  const [imageUrl, setImageUrl] = useState('');
  const [imageLayout, setImageLayout] = useState<ImageLayoutType>('inline-center');
  const [imageZoom] = useState('1');
  const [imagePosition] = useState('center center');
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
        codeBlock: false,
      }),
      CustomImage.configure({
        inline: false,
        allowBase64: true,
      }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      CodeBlock.configure({
        HTMLAttributes: { class: 'report-code-block' },
      }),
    ],
    content: initialValue || '<p></p>',
  });

  useEffect(() => {
    if (editor && isOpen) {
      editor.commands.setContent(initialValue || '<p></p>');
    }
  }, [initialValue, isOpen, editor]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (editor) {
      onSave(editor.getHTML());
      onClose();
    }
  };

  const addOrUpdateImage = async () => {
    if (imageUrl && editor) {
      let finalSrc = imageUrl.trim();

      if (/^[a-zA-Z]:[\\/]/.test(finalSrc)) {
        try {
          finalSrc = await GetLocalImageBase64(finalSrc);
        } catch (err) {
          alert('Kon lokaal bestand niet laden: ' + err);
          return;
        }
      }

      editor.chain().focus().setImage({
        src: finalSrc,
        // @ts-ignore custom attributes
        'data-layout': imageLayout,
        'data-zoom': imageZoom,
        'data-position': imagePosition,
      }).run();

      setImageUrl('');
      setShowImageDialog(false);
    }
  };

  const buttonStyle = (isActive: boolean) => ({
    padding: '6px 10px',
    borderRadius: '4px',
    border: '1px solid ' + (isActive ? '#007acc' : '#cbd5e1'),
    background: isActive ? '#e0f2fe' : '#ffffff',
    color: isActive ? '#0284c7' : '#334155',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

  const handleCloseWithConfirm = () => {
    if (editor && editor.getHTML() !== (initialValue || '<p></p>')) {
      if (window.confirm('Er zijn niet-opgeslagen wijzigingen. Wilt u deze opslaan?')) {
        handleSave();
        return;
      }
    }
    onClose();
  };

  const handleBrowseImage = async () => {
    try {
      const selectedPath = await SelectImageFile();
      if (selectedPath) {
        setImageUrl(selectedPath);
      }
    } catch (err) {
      console.error('Fout bij selecteren afbeelding:', err);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: isMaximized ? '0' : '16px', zIndex: 9999
    }}>
      <div style={{
        background: '#ffffff',
        border: isMaximized ? 'none' : '1px solid #cbd5e1',
        borderRadius: isMaximized ? '0' : '8px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        width: isMaximized ? '100vw' : '850px',
        height: isMaximized ? '100vh' : '80vh',
        minWidth: '450px', minHeight: '350px',
        resize: isMaximized ? 'none' : 'both',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        color: '#1e293b', fontFamily: 'sans-serif'
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc',
          userSelect: 'none'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#0f172a' }}>{title}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button onClick={() => setIsMaximized(!isMaximized)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}>
              {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button onClick={handleCloseWithConfirm} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        {editor && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px',
            padding: '8px 12px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0'
          }}>
            <button onClick={() => editor.chain().focus().toggleBold().run()} style={buttonStyle(editor.isActive('bold'))} title="Vetgedrukt"><Bold size={16} /></button>
            <button onClick={() => editor.chain().focus().toggleItalic().run()} style={buttonStyle(editor.isActive('italic'))} title="Cursief"><Italic size={16} /></button>

            <div style={{ width: '1px', height: '20px', background: '#cbd5e1', margin: '0 4px' }} />

            <button onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()} style={buttonStyle(editor.isActive('highlight', { color: '#fef08a' }))} title="Geel markeren"><Highlighter size={16} color="#d97706" /></button>
            <button onClick={() => editor.chain().focus().toggleHighlight({ color: '#bbf7d0' }).run()} style={buttonStyle(editor.isActive('highlight', { color: '#bbf7d0' }))} title="Groen markeren"><Highlighter size={16} color="#16a34a" /></button>
            <button onClick={() => editor.chain().focus().setColor('#dc2626').run()} style={buttonStyle(editor.isActive('textStyle', { color: '#dc2626' }))} title="Rode tekst"><Palette size={16} color="#dc2626" /></button>
            <button onClick={() => editor.chain().focus().unsetColor().unsetHighlight().run()} style={buttonStyle(false)} title="Opmaak wissen"><span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Clear</span></button>

            <div style={{ width: '1px', height: '20px', background: '#cbd5e1', margin: '0 4px' }} />

            <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} style={buttonStyle(editor.isActive('heading', { level: 1 }))} title="Kop 1"><Heading1 size={16} /></button>
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} style={buttonStyle(editor.isActive('heading', { level: 2 }))} title="Kop 2"><Heading2 size={16} /></button>

            <div style={{ width: '1px', height: '20px', background: '#cbd5e1', margin: '0 4px' }} />

            <button onClick={() => editor.chain().focus().toggleBulletList().run()} style={buttonStyle(editor.isActive('bulletList'))} title="Opsomming"><List size={16} /></button>
            <button onClick={() => editor.chain().focus().toggleOrderedList().run()} style={buttonStyle(editor.isActive('orderedList'))} title="Genummerde lijst"><ListOrdered size={16} /></button>
            <button onClick={() => editor.chain().focus().toggleBlockquote().run()} style={buttonStyle(editor.isActive('blockquote'))} title="Citaat"><Quote size={16} /></button>
            <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} style={buttonStyle(editor.isActive('codeBlock'))} title="Codeblok"><Code size={16} /></button>

            <div style={{ width: '1px', height: '20px', background: '#cbd5e1', margin: '0 4px' }} />

            <button
              onClick={() => setShowImageDialog(!showImageDialog)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px',
                background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px',
                color: '#0284c7', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500
              }}
              title="Afbeelding / Illustratie Invoegen"
            >
              <ImageIcon size={16} />
              <span>Afbeelding Invoegen</span>
            </button>
          </div>
        )}

        {/* Popover voor Afbeeldings opties */}
        {showImageDialog && (
          <div className="p-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center gap-3">
            <div className="flex-1 flex items-center gap-2">
              <input
                type="text"
                placeholder="C:\Pad\naar\foto.jpg of https://..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded text-sm bg-white"
              />
              <button
                type="button"
                onClick={handleBrowseImage}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 rounded text-sm text-slate-700 font-medium transition-colors"
                title="Bladeren op computer"
              >
                <FolderOpen size={16} />
                Bladeren...
              </button>
            </div>

            {/* Dropdown voor Layout */}
            <select
              value={imageLayout}
              onChange={(e) => setImageLayout(e.target.value as ImageLayoutType)}
              className="px-2 py-1.5 border border-slate-300 rounded text-sm bg-white"
            >
              <option value="inline-center">Midden (Groot)</option>
              <option value="inline-left">Links (Tekst eromheen)</option>
              <option value="inline-right">Rechts (Tekst eromheen)</option>
              <option value="span-all">Volledige breedte</option>
            </select>

            <button
              onClick={addOrUpdateImage}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
            >
              Invoegen
            </button>
            <button
              onClick={() => setShowImageDialog(false)}
              className="px-3 py-1.5 bg-slate-300 text-slate-700 rounded text-sm font-medium hover:bg-slate-400"
            >
              Annuleren
            </button>
          </div>
        )}

        {/* Editor gebied */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#ffffff', padding: '16px', color: '#1e293b' }}>
          <EditorContent editor={editor} style={{ height: '100%' }} />
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', padding: '12px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <button onClick={handleCloseWithConfirm} style={{ padding: '6px 12px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#334155', cursor: 'pointer', fontSize: '0.85rem' }}>Annuleren</button>
          <button onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#007acc', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500, fontSize: '0.85rem' }}>
            <Save size={16} />
            Opslaan
          </button>
        </div>

      </div>
    </div>
  );
};