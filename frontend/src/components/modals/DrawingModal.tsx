// src/components/modals/DrawingModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { NodeSearchSelector } from '../../modules/base-module/components/NodeSearchSelector';
import { SearchableObject } from '../../modules/base-module/utils/searchUtils';
import { OpenSvgInInkscape } from '../../../wailsjs/go/main/App'; // Pas het pad aan indi

export interface DrawingModalData {
    svgContent: string;
    width: string;
    layout: 'center' | 'inline-left' | 'inline-right';
    textFlow: 'no-wrap' | 'wrap';
    caption: string;
    backgroundColor: string;
    hasBorder: boolean;
    borderColor: string;
    borderWidth: string;
}
interface DrawingModalProps {
    isOpen: boolean;
    initialSvgContent?: string;
    initialLabel?: string;
    initialWidth?: string;
    initialLayout?: 'center' | 'inline-left' | 'inline-right';
    initialTextFlow?: 'no-wrap' | 'wrap';
    initialCaption?: string;
    initialBgColor?: string;
    initialHasBorder?: boolean;
    initialBorderColor?: string;
    initialBorderWidth?: string;
    availableObjects?: SearchableObject[];
    onClose: () => void;
    onSave: (data: DrawingModalData) => void;
}
type EditorMode = 'visual' | 'code';
type DrawingTool = 'rect' | 'circle' | 'line' | 'text' | 'select' | 'link';

export const DrawingModal: React.FC<DrawingModalProps> = ({
    isOpen,
    initialSvgContent = '',
    initialLabel = '',
    initialWidth = '100%',
    initialLayout = 'center',
    initialTextFlow = 'no-wrap',
    initialCaption = '',
    initialBgColor = '#ffffff',
    initialHasBorder = false,
    initialBorderColor = '#cbd5e1',
    initialBorderWidth = '1px',
    availableObjects = [],
    onClose,
    onSave,
}) => {
    const [mode, setMode] = useState<EditorMode>('visual');
    const [label, setLabel] = useState<string>(initialLabel);
    const [svgContent, setSvgContent] = useState<string>('');
    const [selectedTool, setSelectedTool] = useState<DrawingTool>('rect');

    // Layout & opmaak states
    const [showLayoutPopup, setShowLayoutPopup] = useState<boolean>(false);
    const [drawingWidth, setDrawingWidth] = useState<string>(initialWidth);
    const [drawingLayout, setDrawingLayout] = useState<'center' | 'inline-left' | 'inline-right'>(initialLayout);
    const [textFlow, setTextFlow] = useState<'no-wrap' | 'wrap'>(initialTextFlow);
    const [caption, setCaption] = useState<string>(initialCaption);
    const [backgroundColor, setBackgroundColor] = useState<string>(initialBgColor);
    const [hasBorder, setHasBorder] = useState<boolean>(initialHasBorder);
    const [borderColor, setBorderColor] = useState<string>(initialBorderColor);
    const [borderWidth, setBorderWidth] = useState<string>(initialBorderWidth);

    // States voor het visueel koppelen van links aan een element
    const [showLinkSelector, setShowLinkSelector] = useState<boolean>(false);
    const [pendingElementHtml, setPendingElementHtml] = useState<string | null>(null);

    // Kleur en stijl states voor de visuele editor
    const [fillColor, setFillColor] = useState<string>('#3b82f6');
    const [strokeColor, setStrokeColor] = useState<string>('#1e3a8a');
    const [strokeWidth, setStrokeWidth] = useState<number>(2);

    // Refs voor drag-and-drop functionaliteit
    const isDraggingRef = useRef(false);
    const dragTargetRef = useRef<SVGElement | null>(null);
    const dragStartRef = useRef<{ x: number; y: number; initVals: Record<string, number> }>({
        x: 0,
        y: 0,
        initVals: {},
    });

    useEffect(() => {
        if (initialSvgContent && initialSvgContent.trim() !== '') {
            setSvgContent(initialSvgContent);
        } else {
            setSvgContent('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="350" viewBox="0 0 500 350">\n  <rect width="100%" height="100%" fill="#ffffff"/>\n</svg>');
        }
        setLabel(initialLabel);
        setDrawingWidth(initialWidth || '100%');
        setDrawingLayout(initialLayout || 'center');
        setTextFlow(initialTextFlow || 'no-wrap');
        setCaption(initialCaption || '');
        setBackgroundColor(initialBgColor || '#ffffff');
        setHasBorder(initialHasBorder || false);
        setBorderColor(initialBorderColor || '#cbd5e1');
        setBorderWidth(initialBorderWidth || '1px');
        setShowLinkSelector(false);
        setShowLayoutPopup(false);
        setPendingElementHtml(null);
    }, [initialSvgContent, initialLabel, initialWidth, initialLayout, initialTextFlow, initialCaption, initialBgColor, initialHasBorder, initialBorderColor, initialBorderWidth, isOpen]);

    if (!isOpen) return null;

    // Helper om elementen toe te voegen op basis van klikcoördinaten binnen de SVG
    const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
        if (selectedTool === 'select' || selectedTool === 'link') return;

        const svgElement = e.currentTarget;
        const rect = svgElement.getBoundingClientRect();

        const viewBox = svgElement.viewBox.baseVal;
        const scaleX = viewBox && viewBox.width ? viewBox.width / rect.width : 1;
        const scaleY = viewBox && viewBox.height ? viewBox.height / rect.height : 1;

        const x = Math.round((e.clientX - rect.left) * scaleX);
        const y = Math.round((e.clientY - rect.top) * scaleY);

        let newElement = '';
        if (selectedTool === 'rect') {
            newElement = `  <rect x="${x - 40}" y="${y - 25}" width="80" height="50" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" rx="4"/>`;
        } else if (selectedTool === 'circle') {
            newElement = `  <circle cx="${x}" cy="${y}" r="30" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`;
        } else if (selectedTool === 'line') {
            newElement = `  <line x1="${x - 40}" y1="${y}" x2="${x + 40}" y2="${y}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`;
        } else if (selectedTool === 'text') {
            newElement = `  <text x="${x}" y="${y}" font-family="sans-serif" font-size="14" fill="${strokeColor}">Tekst</text>`;
        }

        const lastSvgIndex = svgContent.lastIndexOf('</svg>');
        if (lastSvgIndex !== -1) {
            const updated = svgContent.substring(0, lastSvgIndex) + newElement + '\n' + svgContent.substring(lastSvgIndex);
            setSvgContent(updated);
        }
    };

    // --- Object gekozen uit de selector, nu wrappen om het aangeklikte element ---
    const finalizeObjectLink = (targetObject: SearchableObject) => {
        if (!pendingElementHtml) {
            setShowLinkSelector(false);
            return;
        }

        const marker = pendingElementHtml;
        const href = `#node-${targetObject.id}`;
        const objectId = targetObject.id;

        const parser = new DOMParser();
        const doc = parser.parseFromString(svgContent, 'image/svg+xml');
        const markedElement = doc.querySelector(`[data-link-marker="${marker}"]`);

        if (markedElement) {
            markedElement.removeAttribute('data-link-marker');

            // Maak een <a> element aan
            const aTag = doc.createElementNS('http://www.w3.org/2000/svg', 'a');
            aTag.setAttribute('href', href);
            aTag.setAttribute('data-object-id', objectId);

            // Plaats het element binnen de <a> tag
            markedElement.parentNode?.replaceChild(aTag, markedElement);
            aTag.appendChild(markedElement);

            // Serialiseer terug naar string
            const serializer = new XMLSerializer();
            const newSvgString = serializer.serializeToString(doc.documentElement);
            setSvgContent(newSvgString);
        }

        setShowLinkSelector(false);
        setPendingElementHtml(null);
    };

    const handleElementClickForLink = (e: React.MouseEvent<SVGElement>) => {
        if (selectedTool !== 'link') return;
        const target = e.target as SVGElement;

        // Negeer de achtergrond
        if (target.tagName === 'svg' || (target.tagName === 'rect' && (target.getAttribute('width') === '100%' || target.getAttribute('height') === '100%'))) {
            return;
        }

        e.stopPropagation();

        // Geef dit element tijdelijk een uniek attribuut in de DOM
        const uniqueMarker = 'link-target-' + Date.now();
        target.setAttribute('data-link-marker', uniqueMarker);

        const svgContainer = e.currentTarget.closest('.interactive-svg-canvas')?.querySelector('svg');
        if (svgContainer) {
            const updatedSvgString = svgContainer.outerHTML;
            setSvgContent(updatedSvgString);

            setPendingElementHtml(uniqueMarker);
            setSelectedTool('select'); // Zet tool terug naar normaal
            setShowLinkSelector(true);  // Open nu de object selector
        }
    };

    // --- Drag and Drop / Move handlers ---
    const handleMouseDown = (e: React.MouseEvent<SVGElement>) => {
        if (selectedTool !== 'select') return;
        const target = e.target as SVGElement;

        if (target.tagName === 'svg' || (target.tagName === 'rect' && (target.getAttribute('width') === '100%' || target.getAttribute('height') === '100%'))) {
            return;
        }

        e.stopPropagation();
        isDraggingRef.current = true;
        dragTargetRef.current = target;

        const initVals: Record<string, number> = {};
        if (target.tagName === 'rect' || target.tagName === 'text') {
            initVals.x = parseFloat(target.getAttribute('x') || '0');
            initVals.y = parseFloat(target.getAttribute('y') || '0');
        } else if (target.tagName === 'circle') {
            initVals.cx = parseFloat(target.getAttribute('cx') || '0');
            initVals.cy = parseFloat(target.getAttribute('cy') || '0');
        } else if (target.tagName === 'line') {
            initVals.x1 = parseFloat(target.getAttribute('x1') || '0');
            initVals.y1 = parseFloat(target.getAttribute('y1') || '0');
            initVals.x2 = parseFloat(target.getAttribute('x2') || '0');
            initVals.y2 = parseFloat(target.getAttribute('y2') || '0');
        }

        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            initVals,
        };
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDraggingRef.current || !dragTargetRef.current) return;

        const svgContainer = e.currentTarget.querySelector('svg');
        if (!svgContainer) return;

        const rect = svgContainer.getBoundingClientRect();
        const viewBox = svgContainer.viewBox.baseVal;
        const scaleX = viewBox && viewBox.width ? viewBox.width / rect.width : 1;
        const scaleY = viewBox && viewBox.height ? viewBox.height / rect.height : 1;

        const dx = (e.clientX - dragStartRef.current.x) * scaleX;
        const dy = (e.clientY - dragStartRef.current.y) * scaleY;
        const init = dragStartRef.current.initVals;
        const target = dragTargetRef.current;

        if (target.tagName === 'rect' || target.tagName === 'text') {
            target.setAttribute('x', String(init.x + dx));
            target.setAttribute('y', String(init.y + dy));
        } else if (target.tagName === 'circle') {
            target.setAttribute('cx', String(init.cx + dx));
            target.setAttribute('cy', String(init.cy + dy));
        } else if (target.tagName === 'line') {
            target.setAttribute('x1', String(init.x1 + dx));
            target.setAttribute('y1', String(init.y1 + dy));
            target.setAttribute('x2', String(init.x2 + dx));
            target.setAttribute('y2', String(init.y2 + dy));
        }
    };

    const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isDraggingRef.current) {
            isDraggingRef.current = false;
            dragTargetRef.current = null;

            const svgContainer = e.currentTarget.querySelector('svg');
            if (svgContainer) {
                setSvgContent(svgContainer.outerHTML);
            }
        }
    };

    const handleSave = () => {
        onSave({
            svgContent,
            width: drawingWidth,
            layout: drawingLayout,
            textFlow,
            caption,
            backgroundColor,
            hasBorder,
            borderColor,
            borderWidth
        });
    };
    const handleOpenInkscape = async () => {
        try {
            const updatedSvg = await OpenSvgInInkscape(svgContent);
            if (updatedSvg) {
                setSvgContent(updatedSvg);
            }
        } catch (err) {
            console.error("Fout bij openen in Inkscape:", err);
        }
    };
    const renderInteractiveSvg = () => {
        if (!svgContent) return null;

        const modifiedSvg = svgContent.replace(/<svg\b([^>]*)>/i, (_match, attributes) => {
            const cleanAttrs = attributes.replace(/\sonclick="[^"]*"/gi, '');
            let cursorStyle = 'crosshair';
            if (selectedTool === 'select') cursorStyle = 'default';
            if (selectedTool === 'link') cursorStyle = 'pointer';
            return `<svg ${cleanAttrs} style="cursor: ${cursorStyle}; max-width: 100%; height: auto;">`;
        });

        return (
            <div
                className="interactive-svg-canvas"
                style={{ display: 'inline-block', userSelect: 'none' }}
                onClick={(e) => {
                    if (selectedTool === 'link') {
                        const svgChild = (e.target as HTMLElement).closest('rect, circle, line, text, path');
                        if (svgChild) {
                            handleElementClickForLink(e as unknown as React.MouseEvent<SVGElement>);
                        }
                    } else if (selectedTool !== 'select') {
                        const svgElem = e.currentTarget.querySelector('svg');
                        if (svgElem) {
                            const clickEvent = {
                                clientX: e.clientX,
                                clientY: e.clientY,
                                currentTarget: svgElem,
                            } as unknown as React.MouseEvent<SVGSVGElement>;
                            handleCanvasClick(clickEvent);
                        }
                    }
                }}
                onMouseDown={(e) => {
                    if (selectedTool === 'select') {
                        const svgChild = (e.target as HTMLElement).closest('rect, circle, line, text');
                        if (svgChild) {
                            handleMouseDown(e as unknown as React.MouseEvent<SVGElement>);
                        }
                    }
                }}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                dangerouslySetInnerHTML={{ __html: modifiedSvg }}
            />
        );
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 10000
        }}>
            <div style={{
                backgroundColor: 'var(--card-bg, #ffffff)',
                color: 'var(--card-text, #1a202c)',
                padding: '24px',
                borderRadius: '8px',
                width: '850px',
                maxWidth: '95vw',
                maxHeight: '90vh',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                overflowY: 'auto',
                position: 'relative'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>Tekening / Schema Bewerken</h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={() => setMode('visual')}
                            style={{
                                padding: '6px 14px',
                                backgroundColor: mode === 'visual' ? '#2563eb' : '#e2e8f0',
                                color: mode === 'visual' ? '#ffffff' : '#475569',
                                border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
                            }}
                        >
                            🎨 Visuele Editor
                        </button>
                        <button
                            onClick={() => setMode('code')}
                            style={{
                                padding: '6px 14px',
                                backgroundColor: mode === 'code' ? '#2563eb' : '#e2e8f0',
                                color: mode === 'code' ? '#ffffff' : '#475569',
                                border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
                            }}
                        >
                            💻 XML Broncode
                        </button>
                    </div>
                </div>

                {/* Label Veld */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Naam / Beschrijving Tekening</label>
                    <input
                        type="text"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        placeholder="Geef een duidelijke naam..."
                        style={{
                            padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1',
                            fontSize: '14px', backgroundColor: 'var(--input-bg, #f8fafc)', color: 'var(--input-text, #0f172a)'
                        }}
                    />
                </div>

                {/* Modus: Visuele Editor */}
                {mode === 'visual' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {/* Toolbar */}
                        <div style={{
                            display: 'flex', gap: '12px', alignItems: 'center', padding: '8px 12px',
                            backgroundColor: '#f1f5f9', borderRadius: '6px', flexWrap: 'wrap', position: 'relative'
                        }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Gereedschap:</span>
                            <button
                                onClick={() => setSelectedTool('select')}
                                style={{ padding: '4px 10px', background: selectedTool === 'select' ? '#2563eb' : '#ffffff', color: selectedTool === 'select' ? '#fff' : '#000', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                            >
                                🖱️ Selecteer & Verplaats
                            </button>
                            <button
                                onClick={() => setSelectedTool('rect')}
                                style={{ padding: '4px 10px', background: selectedTool === 'rect' ? '#2563eb' : '#ffffff', color: selectedTool === 'rect' ? '#fff' : '#000', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                            >
                                ⬜ Rechthoek
                            </button>
                            <button
                                onClick={() => setSelectedTool('circle')}
                                style={{ padding: '4px 10px', background: selectedTool === 'circle' ? '#2563eb' : '#ffffff', color: selectedTool === 'circle' ? '#fff' : '#000', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                            >
                                ⚪ Cirkel
                            </button>
                            <button
                                onClick={() => setSelectedTool('line')}
                                style={{ padding: '4px 10px', background: selectedTool === 'line' ? '#2563eb' : '#ffffff', color: selectedTool === 'line' ? '#fff' : '#000', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                            >
                                ➖ Lijn
                            </button>
                            <button
                                onClick={() => setSelectedTool('text')}
                                style={{ padding: '4px 10px', background: selectedTool === 'text' ? '#2563eb' : '#ffffff', color: selectedTool === 'text' ? '#fff' : '#000', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                            >
                                🔤 Tekst
                            </button>

                            <div style={{ height: '20px', width: '1px', backgroundColor: '#cbd5e1', margin: '0 4px' }} />

                            <button
                                type="button"
                                onClick={() => setSelectedTool('link')}
                                style={{
                                    padding: '4px 10px',
                                    background: selectedTool === 'link' ? '#0284c7' : '#ffffff',
                                    color: selectedTool === 'link' ? '#fff' : '#0284c7',
                                    border: '1px solid #0284c7',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: '500'
                                }}
                            >
                                🔗 Link toevoegen
                            </button>

                            <button
                                type="button"
                                onClick={() => setShowLayoutPopup(!showLayoutPopup)}
                                style={{
                                    padding: '4px 10px',
                                    background: showLayoutPopup ? '#2563eb' : '#ffffff',
                                    color: showLayoutPopup ? '#fff' : '#2563eb',
                                    border: '1px solid #2563eb',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: '500'
                                }}
                            >
                                📐 Layout & Formaat
                            </button>

                            <button
                                type="button"
                                onClick={handleOpenInkscape}
                                style={{
                                    padding: '4px 10px',
                                    background: '#ffffff',
                                    color: '#7c3aed',
                                    border: '1px solid #7c3aed',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: '500',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                                title="Open en bewerk deze SVG in Inkscape"
                            >
                                ✒️ Inkscape
                            </button>

                            {/* Layout Popup */}
                            {showLayoutPopup && (
                                <div style={{
                                    position: 'absolute', top: '50px', right: '10px',
                                    background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px',
                                    padding: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)', zIndex: 10100,
                                    width: '320px', display: 'flex', flexDirection: 'column', gap: '12px', color: '#1e293b',
                                    maxHeight: '80vh', overflowY: 'auto'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Tekening Layout & Opmaak</h4>
                                        <button onClick={() => setShowLayoutPopup(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#64748b' }}>✕</button>
                                    </div>

                                    {/* Breedte */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Breedte ({drawingWidth})</label>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <input
                                                type="range" min="20" max="100" step="5"
                                                value={parseInt(drawingWidth) || 100}
                                                onChange={(e) => {
                                                    const val = e.target.value + '%';
                                                    setDrawingWidth(val);
                                                    if (val === '100%') {
                                                        setTextFlow('no-wrap');
                                                        setDrawingLayout('center');
                                                    } else {
                                                        setTextFlow('wrap');
                                                    }
                                                }}
                                                style={{ flex: 1 }}
                                            />
                                            <input
                                                type="text" value={drawingWidth}
                                                onChange={(e) => setDrawingWidth(e.target.value)}
                                                style={{ width: '60px', padding: '4px', fontSize: '0.85rem', textAlign: 'center', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Positie & Tekstomloop */}
                                    {drawingWidth !== '100%' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Positie & Tekstomloop</label>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => { setDrawingLayout('inline-left'); setTextFlow('wrap'); }}
                                                    style={{
                                                        flex: 1, padding: '6px', fontSize: '0.75rem', borderRadius: '4px', cursor: 'pointer',
                                                        background: drawingLayout === 'inline-left' ? '#e0f2fe' : '#f8fafc',
                                                        border: '1px solid ' + (drawingLayout === 'inline-left' ? '#0284c7' : '#cbd5e1'),
                                                        color: drawingLayout === 'inline-left' ? '#0369a1' : '#334155'
                                                    }}
                                                >
                                                    ⬅️ Links (Omloop)
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setDrawingLayout('inline-right'); setTextFlow('wrap'); }}
                                                    style={{
                                                        flex: 1, padding: '6px', fontSize: '0.75rem', borderRadius: '4px', cursor: 'pointer',
                                                        background: drawingLayout === 'inline-right' ? '#e0f2fe' : '#f8fafc',
                                                        border: '1px solid ' + (drawingLayout === 'inline-right' ? '#0284c7' : '#cbd5e1'),
                                                        color: drawingLayout === 'inline-right' ? '#0369a1' : '#334155'
                                                    }}
                                                >
                                                    ➡️ Rechts (Omloop)
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Achtergrondkleur */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Achtergrondkleur</label>
                                        <input
                                            type="color"
                                            value={backgroundColor}
                                            onChange={(e) => setBackgroundColor(e.target.value)}
                                            style={{ border: 'none', width: '32px', height: '24px', cursor: 'pointer', background: 'none' }}
                                        />
                                    </div>

                                    {/* Kader opties */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                                        <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={hasBorder}
                                                onChange={(e) => setHasBorder(e.target.checked)}
                                            />
                                            Kader rond tekening tonen
                                        </label>

                                        {hasBorder && (
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', paddingLeft: '18px' }}>
                                                <input
                                                    type="color"
                                                    value={borderColor}
                                                    onChange={(e) => setBorderColor(e.target.value)}
                                                    style={{ border: 'none', width: '28px', height: '22px', cursor: 'pointer', background: 'none' }}
                                                />
                                                <select
                                                    value={borderWidth}
                                                    onChange={(e) => setBorderWidth(e.target.value)}
                                                    style={{ padding: '2px 4px', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: '4px', flex: 1 }}
                                                >
                                                    <option value="1px">Dun (1px)</option>
                                                    <option value="2px">Normaal (2px)</option>
                                                    <option value="3px">Dik (3px)</option>
                                                    <option value="4px">Extra dik (4px)</option>
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    {/* Bijschrift */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                                        <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Bijschrift</label>
                                        <input
                                            type="text" placeholder="Optioneel onderschrift..."
                                            value={caption} onChange={(e) => setCaption(e.target.value)}
                                            style={{ padding: '6px', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#f8fafc' }}
                                        />
                                    </div>

                                    {/* Knop om layout popup te bevestigen */}
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                                        <button
                                            type="button"
                                            onClick={() => setShowLayoutPopup(false)}
                                            style={{
                                                padding: '6px 12px',
                                                background: '#2563eb',
                                                color: '#ffffff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                fontSize: '0.8rem',
                                                fontWeight: 'bold',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Toepassen
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div style={{ height: '20px', width: '1px', backgroundColor: '#cbd5e1', margin: '0 4px' }} />

                            <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                Vulkleur:
                                <input type="color" value={fillColor} onChange={(e) => setFillColor(e.target.value)} style={{ border: 'none', width: '28px', height: '24px', cursor: 'pointer' }} />
                            </label>

                            <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                Randkleur:
                                <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} style={{ border: 'none', width: '28px', height: '24px', cursor: 'pointer' }} />
                            </label>

                            <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                Dikte:
                                <input type="number" min="1" max="10" value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} style={{ width: '45px', padding: '2px' }} />
                            </label>
                        </div>

                        {/* Link Selector Popover na aanklikken van een element */}
                        {showLinkSelector && (
                            <div className="p-3 bg-slate-100 border border-slate-200 rounded flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-semibold text-slate-700">
                                        Selecteer het doel-object om aan dit element te koppelen:
                                    </label>
                                    <button
                                        onClick={() => {
                                            setShowLinkSelector(false);
                                            setPendingElementHtml(null);
                                        }}
                                        className="px-2 py-0.5 bg-slate-300 text-slate-700 rounded text-xs hover:bg-slate-400"
                                    >
                                        Annuleren
                                    </button>
                                </div>
                                <NodeSearchSelector
                                    items={availableObjects}
                                    selectedId={null}
                                    onSelect={(selectedObject) => {
                                        finalizeObjectLink(selectedObject);
                                    }}
                                    placeholder="Zoek op label... (bijv. Object##kenmerk)"
                                />
                            </div>
                        )}

                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            {selectedTool === 'select' && '💡 Klik en versleep een vorm op het tekenvel om deze te verplaatsen.'}
                            {selectedTool === 'link' && '🎯 Klik op de vorm in de tekening waaraan je een link wilt koppelen.'}
                            {selectedTool !== 'select' && selectedTool !== 'link' && '💡 Klik op een willekeurige plek in het witte tekenvel hieronder om de geselecteerde vorm toe te voegen.'}
                        </div>

                        {/* Interactief Tekenvel */}
                        <div style={{
                            border: '2px dashed #cbd5e1', borderRadius: '6px',
                            background: '#ffffff', display: 'flex', justifyContent: 'center', alignItems: 'center',
                            overflow: 'auto', minHeight: '380px'
                        }}>
                            {renderInteractiveSvg()}
                        </div>
                    </div>
                )}

                {/* Modus: XML Broncode */}
                {mode === 'code' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>SVG XML Broncode</label>
                        <textarea
                            value={svgContent}
                            onChange={(e) => setSvgContent(e.target.value)}
                            rows={14}
                            style={{
                                width: '100%', fontFamily: 'monospace', padding: '10px', fontSize: '12px',
                                backgroundColor: 'var(--input-bg, #0f172a)', color: '#38bdf8',
                                border: '1px solid #cbd5e1', borderRadius: '4px', resize: 'vertical'
                            }}
                        />
                    </div>
                )}

                {/* Knoppen onderaan */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                    <button
                        onClick={onClose}
                        style={{ padding: '8px 16px', backgroundColor: '#64748b', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        Annuleren
                    </button>
                    <button
                        onClick={handleSave}
                        style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                        Opslaan in Database
                    </button>
                </div>
            </div>
        </div>
    );
};