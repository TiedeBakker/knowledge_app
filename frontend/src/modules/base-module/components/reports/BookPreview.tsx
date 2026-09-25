import React from 'react';
import '../../styles/book-report.css'; // Pas het pad aan afhankelijk van waar je CSS precies staat

interface BookPreviewProps {
  htmlContent: string;
  onOpenObjectEditor: (objectId: string) => void;
  onOpenRichTextEditor: (paramValueId: string, objectId: string) => void;
}

export const BookPreview: React.FC<BookPreviewProps> = ({
  htmlContent,
  onOpenObjectEditor,
  onOpenRichTextEditor,
}) => {
  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // 1. Dubbelklik op RichText Parameter-blok
    const richtextBlock = target.closest('[data-param-value-id]') as HTMLElement;
    if (richtextBlock) {
      e.stopPropagation();
      const paramValueId = richtextBlock.dataset.paramValueId || '';
      const objectId = richtextBlock.dataset.objectId || '';
      onOpenRichTextEditor(paramValueId, objectId);
      return;
    }

    // 2. Dubbelklik op Object Kop
    const headingBlock = target.closest('[data-object-id]') as HTMLElement;
    if (headingBlock) {
      e.stopPropagation();
      const objectId = headingBlock.dataset.objectId || '';
      onOpenObjectEditor(objectId);
      return;
    }
  };

  return (
    <div
      className="book-preview-container"
      onDoubleClick={handleDoubleClick}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
};