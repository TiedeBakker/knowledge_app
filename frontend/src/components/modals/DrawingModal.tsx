// src/components/modals/DrawingModal.tsx
import React, { useState, useEffect } from 'react';

export interface DrawingModalData {
    svgContent: string;
}

interface DrawingModalProps {
    isOpen: boolean;
    initialSvgContent?: string;
    initialLabel?: string;
    onClose: () => void;
    onSave: (data: DrawingModalData) => void;
}

type EditorMode = 'visual' | 'code';
type DrawingTool = 'rect' | 'circle' | 'line' | 'text';

export const DrawingModal: React.FC<DrawingModalProps> = ({
    isOpen,
    initialSvgContent = '',
    initialLabel = '',
    onClose,
    onSave,
}) => {
    const [mode, setMode] = useState<EditorMode>('visual');
    const [label, setLabel] = useState<string>(initialLabel);
    const [svgContent, setSvgContent] = useState<string>('');
    const [selectedTool, setSelectedTool] = useState<DrawingTool>('rect');

    // Kleur en stijl states voor de visuele editor
    const [fillColor, setFillColor] = useState<string>('#3b82f6');
    const [strokeColor, setStrokeColor] = useState<string>('#1e3a8a');
    const [strokeWidth, setStrokeWidth] = useState<number>(2);

    useEffect(() => {
        if (initialSvgContent && initialSvgContent.trim() !== '') {
            setSvgContent(initialSvgContent);
        } else {
            // Standaard lege SVG canvas van 500x350
            setSvgContent('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="350" viewBox="0 0 500 350">\n  <rect width="100%" height="100%" fill="#ffffff"/>\n</svg>');
        }
        setLabel(initialLabel);
    }, [initialSvgContent, initialLabel, isOpen]);

    if (!isOpen) return null;

    // Helper om elementen toe te voegen op basis van klikcoördinaten binnen de SVG
    const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
        const svgElement = e.currentTarget;
        const rect = svgElement.getBoundingClientRect();
        
        // Bereken schaling indien de SVG responsief wordt getoond
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

        // Voeg het element in net voor de afsluitende </svg> tag
        const lastSvgIndex = svgContent.lastIndexOf('</svg>');
        if (lastSvgIndex !== -1) {
            const updated = svgContent.substring(0, lastSvgIndex) + newElement + '\n' + svgContent.substring(lastSvgIndex);
            setSvgContent(updated);
        }
    };

    const handleSave = () => {
        onSave({ svgContent });
    };

    // Parser hack om de string dynamisch als interactieve SVG te renderen met onClick
    const renderInteractiveSvg = () => {
        if (!svgContent) return null;
        
        // Gecorrigeerd: gebruik `_match` om aan te geven dat de parameter bewust niet wordt gebruikt
        const modifiedSvg = svgContent.replace(/<svg\b([^>]*)>/i, (_match, attributes) => {
            const cleanAttrs = attributes.replace(/\sonclick="[^"]*"/gi, '');
            return `<svg ${cleanAttrs} style="cursor: crosshair; max-width: 100%; height: auto;">`;
        });

        return (
            <div 
                style={{ display: 'inline-block' }}
                onClick={(e) => {
                    const svgElem = e.currentTarget.querySelector('svg');
                    if (svgElem) {
                        const clickEvent = {
                            clientX: e.clientX,
                            clientY: e.clientY,
                            currentTarget: svgElem,
                        } as unknown as React.MouseEvent<SVGSVGElement>;
                        handleCanvasClick(clickEvent);
                    }
                }}
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
                overflowY: 'auto'
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
                            backgroundColor: '#f1f5f9', borderRadius: '6px', flexWrap: 'wrap'
                        }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Gereedschap:</span>
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

                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            💡 Klik op een willekeurige plek in het witte tekenvel hieronder om de geselecteerde vorm toe te voegen.
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