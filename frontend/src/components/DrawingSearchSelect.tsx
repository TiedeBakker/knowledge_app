// frontend/src/components/DrawingSearchSelect.tsx
import React, {useState, useCallback } from 'react';
import AsyncSelect from 'react-select/async';
import { GetDrawingObjects } from '../../wailsjs/go/main/App';

export interface DrawingOption {
    value: string; // id of 'NEW'
    label: string;
    svgContent?: string;
    isNew: boolean;
}

interface Props {
    onSelectDrawing: (option: DrawingOption | null) => void;
    placeholder?: string;
}

export const DrawingSearchSelect: React.FC<Props> = ({ 
    onSelectDrawing, 
    placeholder = "Selecteer of zoek een tekening..." 
}) => {
    const [selectedOption, setSelectedOption] = useState<DrawingOption | null>(null);

    const loadOptions = useCallback(async (inputValue: string): Promise<DrawingOption[]> => {
        try {
            const drawings = await GetDrawingObjects();
            
            // Vaste optie op positie 1
            const newOption: DrawingOption = {
                value: 'NEW',
                label: '➕ Nieuwe tekening',
                svgContent: '',
                isNew: true
            };

            const existingOptions: DrawingOption[] = (drawings || []).map(d => ({
                value: d.id,
                label: `📐 ${d.label}`,
                svgContent: d.svgContent,
                isNew: false
            }));

            const filtered = existingOptions.filter(opt => 
                opt.label.toLowerCase().includes(inputValue.toLowerCase())
            );

            // Altijd "Nieuwe tekening" bovenaan
            return [newOption, ...filtered];
        } catch (error) {
            console.error("Fout bij ophalen tekeningen:", error);
            return [{ value: 'NEW', label: '➕ Nieuwe tekening', svgContent: '', isNew: true }];
        }
    }, []);

    return (
        <AsyncSelect<DrawingOption>
            cacheOptions
            defaultOptions
            value={selectedOption}
            loadOptions={loadOptions}
            onChange={(option) => {
                setSelectedOption(option);
                onSelectDrawing(option);
            }}
            placeholder={placeholder}
            isClearable={false}
            noOptionsMessage={() => "Geen tekeningen gevonden"}
            loadingMessage={() => "Laden..."}
            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
            menuPosition="fixed"
            styles={{
                control: (base) => ({
                    ...base,
                    borderColor: '#ccc',
                    boxShadow: 'none',
                    '&:hover': { borderColor: '#007acc' }
                }),
                option: (base, state) => ({
                    ...base,
                    backgroundColor: state.isFocused ? '#e6f2ff' : 'white',
                    color: 'black',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '13px',
                }),
                menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                menuList: (base) => ({ ...base, maxHeight: '250px' })
            }}
        />
    );
};