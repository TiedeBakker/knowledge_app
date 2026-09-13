import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { 
  Bold, Italic, List, ListOrdered, Heading1, Heading2, 
  Quote, ImageIcon, X, Save 
} from 'lucide-react';

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
    };
  },
});

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
  const [imageLayout, setImageLayout] = useState<'inline-left' | 'inline-right' | 'inline-center' | 'span-all'>('inline-center');
  const [showImageDialog, setShowImageDialog] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
      }),
      CustomImage.configure({
        inline: false,
        allowBase64: true,
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
      const html = editor.getHTML();
      onSave(html);
      onClose();
    }
  };

  const addImage = () => {
    if (imageUrl && editor) {
      editor.chain().focus().setImage({ 
        src: imageUrl, 
        // @ts-ignore custom attribute
        'data-layout': imageLayout 
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

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      zIndex: 9999
    }}>
      <div style={{
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        width: '100%',
        maxWidth: '800px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: '#1e293b',
        fontFamily: 'sans-serif'
      }}>
        
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>{title}</h3>
          <button 
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar */}
        {editor && (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '4px',
            padding: '8px 12px',
            background: '#f1f5f9',
            borderBottom: '1px solid #e2e8f0'
          }}>
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              style={buttonStyle(editor.isActive('bold'))}
              title="Vetgedrukt"
            >
              <Bold size={16} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              style={buttonStyle(editor.isActive('italic'))}
              title="Cursief"
            >
              <Italic size={16} />
            </button>

            <div style={{ width: '1px', height: '20px', background: '#cbd5e1', margin: '0 4px' }} />

            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              style={buttonStyle(editor.isActive('heading', { level: 1 }))}
              title="Kop 1"
            >
              <Heading1 size={16} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              style={buttonStyle(editor.isActive('heading', { level: 2 }))}
              title="Kop 2"
            >
              <Heading2 size={16} />
            </button>

            <div style={{ width: '1px', height: '20px', background: '#cbd5e1', margin: '0 4px' }} />

            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              style={buttonStyle(editor.isActive('bulletList'))}
              title="Opsomming"
            >
              <List size={16} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              style={buttonStyle(editor.isActive('orderedList'))}
              title="Genummerde lijst"
            >
              <ListOrdered size={16} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              style={buttonStyle(editor.isActive('blockquote'))}
              title="Citaat"
            >
              <Quote size={16} />
            </button>

            <div style={{ width: '1px', height: '20px', background: '#cbd5e1', margin: '0 4px' }} />

            <button
              onClick={() => setShowImageDialog(!showImageDialog)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                color: '#0284c7',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 500
              }}
              title="Afbeelding/Illustratie invoegen"
            >
              <ImageIcon size={16} />
              <span>Afbeelding Invoegen</span>
            </button>
          </div>
        )}

        {/* Popover/Dialog voor Afbeeldingen */}
        {showImageDialog && (
          <div style={{
            padding: '12px 16px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>
              Afbeelding Invoegen & Layout instellen
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Afbeelding URL (https://... of data:image/...)"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                style={{
                  flex: 1,
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  padding: '6px 10px',
                  color: '#1e293b',
                  fontSize: '0.85rem'
                }}
              />
              <select
                value={imageLayout}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setImageLayout(e.target.value as any)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  padding: '6px 10px',
                  color: '#1e293b',
                  fontSize: '0.85rem'
                }}
              >
                <option value="inline-left">1 Kolom (Links uitgelijnd)</option>
                <option value="inline-center">1 Kolom (Gecentreerd)</option>
                <option value="inline-right">1 Kolom (Rechts uitgelijnd)</option>
                <option value="span-all">2 Kolommen Breed (Volle pagina)</option>
              </select>
              <button
                onClick={addImage}
                style={{
                  padding: '6px 12px',
                  background: '#007acc',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '0.85rem'
                }}
              >
                Invoegen
              </button>
            </div>
          </div>
        )}

        {/* Editor gebied */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          background: '#ffffff',
          padding: '16px',
          minHeight: '280px',
          color: '#1e293b'
        }}>
          <EditorContent editor={editor} />
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '8px',
          padding: '12px 20px',
          borderTop: '1px solid #e2e8f0',
          background: '#f8fafc'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 12px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              color: '#334155',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            Annuleren
          </button>
          <button
            onClick={handleSave}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: '#007acc',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '0.85rem'
            }}
          >
            <Save size={16} />
            Opslaan
          </button>
        </div>

      </div>
    </div>
  );
};