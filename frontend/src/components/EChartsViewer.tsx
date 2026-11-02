// frontend/src/components/EChartsViewer.tsx
import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts'; 

interface EChartsViewerProps {
    codes?: string[];
    points?: any[];
    rawOption?: string | Record<string, any>;
    onExportSvg?: (svgString: string) => void;
    connectNulls?: boolean;          
    ignoreZeroValues?: boolean;      
}

export const EChartsViewer: React.FC<EChartsViewerProps> = ({
    codes = [],
    points = [],
    rawOption,
    onExportSvg,
    connectNulls = false,
    ignoreZeroValues = false
}) => {
    const chartRef = useRef<HTMLDivElement>(null);
    const chartInstanceRef = useRef<echarts.ECharts | null>(null);

    useEffect(() => {
        if (!chartRef.current) return;

        let parsedOpt: Record<string, any> = {};

        try {
            if (typeof rawOption === 'string') {
                parsedOpt = JSON.parse(rawOption);
            } else if (rawOption && typeof rawOption === 'object') {
                parsedOpt = (rawOption as any).rawOption || rawOption;
            }
        } catch (e) {
            console.error("Fout bij parsen rawOption:", e);
        }

        const hasValidKeys = parsedOpt && (parsedOpt.xAxis || parsedOpt.series || parsedOpt.title);

        const baseOption = hasValidKeys ? parsedOpt : {
            title: { text: 'Tijdreeks Analyse', left: 'center' },
            tooltip: { trigger: 'axis' },
            legend: { bottom: 0 },
            grid: { top: '15%', left: '5%', right: '5%', bottom: '15%', containLabel: true },
            xAxis: { type: 'time' },
            yAxis: { type: 'value' },
            series: []
        };

        const xAxisConfig = baseOption.xAxis || { type: 'time' };
        const xAxisType = xAxisConfig.type || 'time';

        // X-as datums opbouwen
        const xAxisData = points.map(pt => {
            const dateObj = new Date(pt.timestamp);
            return xAxisType === 'time' ? dateObj.getTime() : dateObj.toLocaleDateString();
        });

        const templateSeries = Array.isArray(baseOption.series) ? baseOption.series : [];

        // 🎯 JOUW NIEUWE ONTWERP: Mapped per serie op basis van de meegeleverde 'code' property in de template
        const dynamicSeries = templateSeries.map((seriesItem: any) => {
            const targetCode = seriesItem.code; // De gekoppelde database parameter code (bijv. "AFG_EN_TOTAAL")

            // Als er geen code in de serie staat, behouden we hem statisch zoals hij is
            if (!targetCode) {
                return seriesItem;
            }

            return {
                ...seriesItem,
                type: seriesItem.type || 'line',
                connectNulls: connectNulls,
                data: points.map(pt => {
                    const timestamp = new Date(pt.timestamp).getTime();
                    const vals = pt.values || {};
                    const val = vals[targetCode];

                    if (val === undefined || val === null || val === '' || (typeof val === 'string' && val.trim() === '')) {
                        return xAxisType === 'time' ? [timestamp, null] : null;
                    }

                    const num = Number(val);
                    if (isNaN(num)) {
                        return xAxisType === 'time' ? [timestamp, null] : null;
                    }

                    if (ignoreZeroValues && num === 0) {
                        return xAxisType === 'time' ? [timestamp, null] : null;
                    }

                    return xAxisType === 'time' ? [timestamp, num] : num;
                })
            };
        });

const finalOption = {
    ...baseOption,                      // <--- NEEMT ALLES MEE: title, tooltip, grid, yAxis, toolbox, etc.
    xAxis: {
        ...xAxisConfig,                 // <--- De x-as configuratie uit je template
        data: xAxisType === 'category' ? xAxisData : undefined // (of dynamische datums als het een category-as is)
    },
    series: dynamicSeries               // <--- Onze dynamisch geïnjecteerde meetwaarden per serie
};

        const containerWidth = chartRef.current.clientWidth || 600;

        if (!chartInstanceRef.current) {
            chartInstanceRef.current = echarts.init(chartRef.current, null, {
                renderer: 'svg',
                width: containerWidth,
                height: 300
            });
        }

        const chart = chartInstanceRef.current;
        chart.setOption(finalOption, true);

        if (onExportSvg) {
            const svgStr = (chart as any).renderToSVGString();
            if (svgStr) {
                onExportSvg(svgStr);
            }
        }

        const handleResize = () => {
            chart.resize();
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.dispose();
            chartInstanceRef.current = null;
        };
    }, [rawOption, codes, points, connectNulls, ignoreZeroValues, onExportSvg]);

    return (
        <div style={{ width: '100%', backgroundColor: '#fff', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}>
            <div ref={chartRef} style={{ width: '100%', height: '300px' }} />
        </div>
    );
};