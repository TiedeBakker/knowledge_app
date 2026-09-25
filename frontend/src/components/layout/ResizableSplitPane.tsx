import React, { useState, useCallback, useEffect } from 'react';

interface Props {
    left: React.ReactNode;
    right: React.ReactNode;
    initialLeftWidthPercent?: number; // Standaard bijv. 50%
    minWidthPixels?: number;          // Minimale breedte per venster
}

export const ResizableSplitPane: React.FC<Props> = ({
    left,
    right,
    initialLeftWidthPercent = 50,
    minWidthPixels = 200,
}) => {
    const [leftWidthPercent, setLeftWidthPercent] = useState<number>(initialLeftWidthPercent);
    const [isDragging, setIsDragging] = useState<boolean>(false);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!isDragging) return;

            const containerWidth = window.innerWidth;
            // Bepaal het percentage op basis van de muispositie
            let newLeftWidthPercent = (e.clientX / containerWidth) * 100;

            // Omrekenen naar pixels voor de minimale grenzen
            const leftPx = (newLeftWidthPercent / 100) * containerWidth;
            const rightPx = containerWidth - leftPx;

            if (leftPx >= minWidthPixels && rightPx >= minWidthPixels) {
                setLeftWidthPercent(newLeftWidthPercent);
            }
        },
        [isDragging, minWidthPixels]
    );

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    return (
        <div
            style={{
                display: 'flex',
                flex: 1,
                width: '100%',
                height: '100%',
                overflow: 'hidden', // Voorkomt dat de split-pane zelf scrollbalken genereert
                userSelect: isDragging ? 'none' : 'auto',
            }}
        >
            {/* LINKER VENSTER */}
            <div
                style={{
                    width: `${leftWidthPercent}%`,
                    height: '100%',
                    overflow: 'hidden', // Zet dit op 'hidden' (of laat het afhangen van de component erin)
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                {left}
            </div>

            {/* SLEEPBALK (SPLITTER) */}
            <div
                onMouseDown={handleMouseDown}
                style={{
                    width: '8px',
                    cursor: 'col-resize',
                    backgroundColor: isDragging ? '#007acc' : '#2d2d3f',
                    transition: 'background-color 0.2s ease',
                    zIndex: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                }}
                title="Sleep om vensters te vergroten/verkleinen"
            >
                <div style={{ width: '2px', height: '24px', backgroundColor: '#aaa', borderRadius: '1px' }} />
            </div>

            {/* RECHTER VENSTER */}
            <div
                style={{
                    width: `${100 - leftWidthPercent}%`,
                    height: '100%',
                    overflow: 'hidden', // Zet dit op 'hidden'
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                {right}
            </div>
        </div>
    );
};