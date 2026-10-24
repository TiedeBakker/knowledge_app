import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import CodeBlock from '@tiptap/extension-code-block';
import Link from '@tiptap/extension-link';
import {
  Bold, Italic, List, ListOrdered, Heading1, Heading2,
  Quote, X, Save, Highlighter, Palette,
  Maximize2, Minimize2, Code, FolderOpen, Link as LinkIcon, Unlink
} from 'lucide-react';
import { GetLocalImageBase64, SelectImageFile } from '../../wailsjs/go/main/App';

// Importeer de NodeSearchSelector (controleer eventueel het relatieve pad)
import { NodeSearchSelector } from '../modules/base-module/components/NodeSearchSelector';
import { SearchableObject } from '../modules/base-module/utils/searchUtils';
import { ImageModal, ImageModalData } from './modals/ImageModal';
import { resolveMediaHtml } from '../utils/mediaHelper';
import { GetPhotoFilePath } from '../../wailsjs/go/main/App';


// Custom Tiptap Link extension met 'data-object-id' ondersteuning
const CustomLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      'data-object-id': {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-object-id'),
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes['data-object-id']) return {};
          return { 'data-object-id': attributes['data-object-id'] };
        },
      },
    };
  },
});

const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      src: {
        default: null,
        parseHTML: (element) => {
          const img = element.tagName === 'FIGURE' ? element.querySelector('img') : element;
          return img?.getAttribute('src');
        },
      },
      'data-media-id': {
        default: null,
        parseHTML: (element) => {
          const figure = element.closest('figure') || (element.tagName === 'FIGURE' ? element : null);
          const img = element.tagName === 'FIGURE' ? element.querySelector('img') : element;
          return figure?.getAttribute('data-media-id') || img?.getAttribute('data-media-id');
        },
        renderHTML: (attributes) => {
          if (!attributes['data-media-id']) return {};
          return { 'data-media-id': attributes['data-media-id'] };
        },
      },
      'data-layout': {
        default: 'inline-left',
        parseHTML: (element) => {
          const figure = element.closest('figure') || (element.tagName === 'FIGURE' ? element : null);
          const img = element.tagName === 'FIGURE' ? element.querySelector('img') : element;
          return figure?.getAttribute('data-layout') || img?.getAttribute('data-layout');
        },
        renderHTML: (attributes) => {
          if (!attributes['data-layout']) return {};
          return { 'data-layout': attributes['data-layout'] };
        },
      },
      'data-caption': {
        default: '',
        parseHTML: (element) => {
          const figure = element.closest('figure') || (element.tagName === 'FIGURE' ? element : null);
          const img = element.tagName === 'FIGURE' ? element.querySelector('img') : element;
          const figcaption = figure?.querySelector('figcaption');
          return figcaption?.textContent || figure?.getAttribute('data-caption') || img?.getAttribute('data-caption') || img?.getAttribute('alt') || '';
        },
        renderHTML: (attributes) => {
          if (!attributes['data-caption']) return {};
          return {
            'data-caption': attributes['data-caption'],
            alt: attributes['data-caption'],
            title: attributes['data-caption'],
          };
        },
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    const layout = HTMLAttributes['data-layout'] || 'inline-left';
    const caption = HTMLAttributes['data-caption'] || '';
    const mediaId = HTMLAttributes['data-media-id'] || '';

    const figure = document.createElement('figure');
    figure.setAttribute('data-layout', layout);
    if (mediaId) figure.setAttribute('data-media-id', mediaId);
    if (caption) figure.setAttribute('data-caption', caption);
    figure.className = `image-wrapper layout-${layout}`;

    const img = document.createElement('img');
    img.setAttribute('src', HTMLAttributes['src'] || '');
    if (mediaId) img.setAttribute('data-media-id', mediaId);
    if (layout) img.setAttribute('data-layout', layout);
    if (caption) {
      img.setAttribute('data-caption', caption);
      img.setAttribute('alt', caption);
      img.setAttribute('title', caption);
    }
    figure.appendChild(img);

    if (caption) {
      const figcaption = document.createElement('figcaption');
      figcaption.textContent = caption;
      figure.appendChild(figcaption);
    }

    return figure;
  },
});
type ImageLayoutType = 'inline-left' | 'inline-right' | 'inline-center' | 'span-all';

interface RichTextEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialValue: string;
  title?: string;
  onSave: (htmlContent: string) => void;
  availableObjects?: SearchableObject[]; // <--- Nieuwe prop voor de NodeSearchSelector
}

export const RichTextEditorModal: React.FC<RichTextEditorModalProps> = ({
  isOpen,
  onClose,
  initialValue,
  title = 'Tekst en Illustraties Bewerken',
  onSave,
  availableObjects = [], // Default naar lege array indien niet meegegeven
}) => {
  const [imageUrl, setImageUrl] = useState('');
  const [imageLayout, setImageLayout] = useState<ImageLayoutType>('inline-center');
  const [imageZoom] = useState('1');
  const [imagePosition] = useState('center center');
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [editingImageData, setEditingImageData] = useState<ImageModalData | null>(null);

  // Open de modal leeg vanuit de Toolbar-knop
  const handleOpenAddImage = () => {
    setEditingImageData(null);
    setIsImageModalOpen(true);
  };

const handleEditorDoubleClick = (event: React.MouseEvent) => {
    if (!editor) return;

    // Zoek het HTML element waar op geklikt is
    const target = event.target as HTMLElement;
    const element = target.closest('figure, img') as HTMLElement;

    if (element) {
      const imgElement = element.tagName === 'FIGURE' ? element.querySelector('img') : element;
      
      const mediaId = element.getAttribute('data-media-id') || imgElement?.getAttribute('data-media-id') || '';
      const layout = (element.getAttribute('data-layout') || imgElement?.getAttribute('data-layout') as any) || 'inline-left';
      const caption = element.getAttribute('data-caption') || imgElement?.getAttribute('data-caption') || '';

      console.log("[Doubleclick] Gevonden afbeeldingsdata:", { mediaId, layout, caption });

      setEditingImageData({ mediaId, layout, caption });
      setIsImageModalOpen(true);
    }
  };
// Helper om bij opslaan de file:// paden weer terug te zetten naar media:// voor in de database
const cleanHtmlForSave = (htmlContent: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const images = doc.querySelectorAll('img[data-media-id]');

  for (const img of Array.from(images)) {
    const mediaId = img.getAttribute('data-media-id');
    if (mediaId) {
      img.setAttribute('src', `media://${mediaId}`);
    }
  }

  return doc.body.innerHTML;
};
// Opslaan vanuit ImageModal (ondersteunt zowel nieuw toevoegen als bewerken)
  const handleSaveImageModal = async (data: ImageModalData) => {
    if (editor) {
      let finalSrc = `media://${data.mediaId}`;
      try {
        const filePath = await GetPhotoFilePath(data.mediaId);
        if (filePath) {
          finalSrc = `${filePath.replace(/\\/g, '/')}`;
        }
      } catch (err) {
        console.error("Kon afbeeldingspad niet ophalen:", err);
      }

      // Als we aan het bewerken waren (editingImageData is niet null), update dan de node
      if (editingImageData) {
        editor
          .chain()
          .focus()
          .updateAttributes('image', {
            src: finalSrc,
            'data-media-id': data.mediaId,
            'data-layout': data.layout,
            'data-caption': data.caption,
          })
          .run();
      } else {
        // Anders voegen we een nieuwe toe
        editor
          .chain()
          .focus()
          .setImage({
            src: finalSrc,
            'data-media-id': data.mediaId,
            'data-layout': data.layout,
            'data-caption': data.caption,
          } as any)
          .run();
      }
    }
    setEditingImageData(null);
    setIsImageModalOpen(false);
  };
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
      CustomLink.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'report-internal-link',
        },
      }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      CodeBlock.configure({
        HTMLAttributes: { class: 'report-code-block' },
      }),
    ],
    content: initialValue,
    editorProps: {
      attributes: {
        class: 'prose focus:outline-none max-w-none',
      },
      // Hier koppel je de dubbelklik-handler netjes in:
      handleDOMEvents: {
        dblclick: (_view, event) => {
          handleEditorDoubleClick(event as unknown as React.MouseEvent);
          return false;
        },
      },
    },
  });

  useEffect(() => {
  let isMounted = true;
  async function loadContent() {
    // initialValue is bijvoorbeeld de parameterwaarde uit de database met media://...
    const resolvedHtml = await resolveMediaHtml(initialValue);
    if (isMounted && editor) {
      editor.commands.setContent(resolvedHtml);
    }
  }
  loadContent();
  return () => { isMounted = false; };
}, [initialValue, editor]);

  useEffect(() => {
    if (editor && isOpen) {
      editor.commands.setContent(initialValue || '<p></p>');
    }
  }, [initialValue, isOpen, editor]);

  if (!isOpen) return null;

const handleSave = () => {
  if (editor) {
    const rawHtml = editor.getHTML();
    const cleanHtml = cleanHtmlForSave(rawHtml); // Zet om naar media:// voor de database
    onSave(cleanHtml);
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

  // Interne link invoegen op basis van het geselecteerde object
  const handleInsertObjectLink = (targetObject: SearchableObject) => {
    if (!editor) return;

    // Gebruik expliciet '#node-' als anchor sodat dit matchet met de HTML/PDF koppen
    const anchorHref = `#node-${targetObject.id}`;
    const { from, to } = editor.state.selection;
    const hasSelection = from !== to;

    if (hasSelection) {
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({
          href: anchorHref,
          // @ts-ignore custom attribute
          'data-object-id': targetObject.id,
        })
        .run();
    } else {
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'text',
          text: targetObject.label,
          marks: [
            {
              type: 'link',
              attrs: {
                href: anchorHref,
                'data-object-id': targetObject.id,
                class: 'report-internal-link',
              },
            },
          ],
        })
        .run();
    }

    setShowLinkDialog(false);
  };

  const handleRemoveLink = () => {
    if (editor) {
      editor.chain().focus().unsetLink().run();
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

            {/* Interne Link Knop */}
            <button
              onClick={() => {
                setShowLinkDialog(!showLinkDialog);
                setShowImageDialog(false);
              }}
              style={buttonStyle(editor.isActive('link'))}
              title="Link naar ander Object toevoegen"
            >
              <LinkIcon size={16} />
            </button>

            {editor.isActive('link') && (
              <button
                onClick={handleRemoveLink}
                style={buttonStyle(false)}
                title="Link verwijderen"
              >
                <Unlink size={16} color="#dc2626" />
              </button>
            )}

            <div style={{ width: '1px', height: '20px', background: '#cbd5e1', margin: '0 4px' }} />

            {/* <button // OUDE INVOEGKNOP, VERVANGEN DOOR IMAGE MODAL
              onClick={() => {
                setShowImageDialog(!showImageDialog);
                setShowLinkDialog(false);
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px',
                background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px',
                color: '#0284c7', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500
              }}
              title="Afbeelding / Illustratie Invoegen"
            >
              <ImageIcon size={16} />
              <span>Afbeelding Invoegen</span>
            </button> */}
            <button
              type="button"
              onClick={handleOpenAddImage}
              title="Foto-object invoegen"
            >
              🖼️ Foto invoegen
            </button>
          </div>
        )}

        {/* Popover met geavanceerde NodeSearchSelector voor Interne Links */}
        {showLinkDialog && (
          <div className="p-3 bg-slate-100 border-b border-slate-200 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-700">
                Selecteer doel-object voor de link:
              </label>
              <button
                onClick={() => setShowLinkDialog(false)}
                className="px-2 py-1 bg-slate-300 text-slate-700 rounded text-xs font-medium hover:bg-slate-400"
              >
                Annuleren
              </button>
            </div>

            <div className="flex items-center gap-2">
              <NodeSearchSelector
                items={availableObjects}
                selectedId={null}
                onSelect={(selectedObject) => {
                  handleInsertObjectLink(selectedObject);
                }}
                placeholder="Zoek op label... (bijv. Organisatie##foto)"
              />
            </div>
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

        <ImageModal
          isOpen={isImageModalOpen}
          initialData={editingImageData}
          onClose={() => setIsImageModalOpen(false)}
          onSave={handleSaveImageModal}
        />

      </div>
    </div>
  );
};