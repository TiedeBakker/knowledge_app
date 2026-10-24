import React, { useEffect, useState } from 'react';
import { resolveMediaHtml } from '../../../../../../frontend/src/utils/mediaHelper';

interface BookPreviewProps {
  htmlContent: string;
  onOpenObjectEditor?: (objectId: string) => void;
  onOpenRichTextEditor?: (paramValueId: string, objectId: string) => void;
}

export const BookPreview: React.FC<BookPreviewProps> = ({
  htmlContent,
  onOpenObjectEditor,
  onOpenRichTextEditor,
}) => {
  const [processedHtml, setProcessedHtml] = useState<string>('');

  // Vertaal media:// naar http://localhost/media-archive/... zodra htmlContent wijzigt
  useEffect(() => {
    let isMounted = true;
    async function processContent() {
      if (!htmlContent) {
        setProcessedHtml('');
        return;
      }
      const resolved = await resolveMediaHtml(htmlContent);
      if (isMounted) {
        setProcessedHtml(resolved);
      }
    }
    processContent();
    return () => {
      isMounted = false;
    };
  }, [htmlContent]);

  // Handler voor dubbelklikken op bewerkbare teksten / titels / foto's
  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // Check voor dubbelklik op een foto / figuur (indien je ook direct vanuit de preview wilt kunnen bewerken)
    const figureEl = target.closest('figure, img') as HTMLElement;
    if (figureEl) {
      const mediaId = figureEl.getAttribute('data-media-id') || figureEl.querySelector('img')?.getAttribute('data-media-id');
      if (mediaId && onOpenRichTextEditor) {
        // Indien gewenst kun je hier eventueel ook een actie koppelen, 
        // maar de richtext editor modal handelt foto's al af via de dubbelklik in de editor.
      }
    }

    // Check voor dubbelklik op een titel/kop met object ID
    const headingEl = target.closest('[data-object-id]') as HTMLElement;
    if (headingEl && onOpenObjectEditor && !target.closest('[data-param-value-id]')) {
      const objectId = headingEl.getAttribute('data-object-id');
      if (objectId) {
        onOpenObjectEditor(objectId);
        return;
      }
    }

    // Check voor dubbelklik op een RichText parameterblok
    const paramEl = target.closest('[data-param-value-id]') as HTMLElement;
    if (paramEl && onOpenRichTextEditor) {
      const paramValueId = paramEl.getAttribute('data-param-value-id');
      const objectId = paramEl.getAttribute('data-target-id') || paramEl.getAttribute('data-object-id') || '';
      if (paramValueId) {
        onOpenRichTextEditor(paramValueId, objectId);
      }
    }
  };

  // Handler voor Enkele Klik op Interne Links
  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const link = (e.target as HTMLElement).closest('a.report-internal-link');
    if (!link) return;

    // Voorkom standaard navigatie/herladen
    e.preventDefault();
    e.stopPropagation();

    const objectId = link.getAttribute('data-object-id');
    const href = link.getAttribute('href');

    // Bepaal de kale ID zonder eventuele hash of prefixes
    const rawId = objectId || href?.replace('#object-', '').replace('#node-', '').replace('#', '');

    if (rawId) {
      // Zoek flexibel: eerst via id "node-UUID", dan "object-UUID", of via attribuut [data-object-id="UUID"]
      const targetElement =
        document.getElementById(`node-${rawId}`) ||
        document.getElementById(`object-${rawId}`) ||
        document.querySelector(`[data-object-id="${rawId}"]`);

      if (targetElement) {
        // Het object is gevonden: scroll er vloeiend naartoe
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        // Het object ontbreekt daadwerkelijk in de rapportboom
        alert(
          `Het gekoppelde object (ID: ${rawId}) is niet opgenomen in de huidige rapportboom.\n\n` +
          `Neem het object op in de structuur of verwijder/pas de link aan.`
        );
      }
    }
  };

  return (
    <div
      className="book-report-wrapper"
      onClick={handlePreviewClick}
      onDoubleClick={handleDoubleClick}
      style={{ minHeight: '100%', cursor: 'pointer' }}
      dangerouslySetInnerHTML={{ __html: processedHtml }}
    />
  );
};