// src/modules/meetwaarden/MeetreeksSearchSelect.tsx
import React, { useState, useCallback } from 'react';
import AsyncSelect from 'react-select/async';
import { GetMeetreeksOptions } from '../../../../frontend/wailsjs/go/main/App';

export interface MeetreeksOptionItem {
    value: string; // De 'key' (bijv. "existing:<id>" of "new:<objectId>")
    label: string; // De 'displayLabel'
    isNew: boolean;
    objectId: string;
    meetreeksId?: string;
}

interface Props {
    value?: MeetreeksOptionItem | null;
    onSelect: (option: MeetreeksOptionItem | null) => void;
    placeholder?: string;
}

export const MeetreeksSearchSelect: React.FC<Props> = ({ 
    value,
    onSelect, 
    placeholder = "Zoek bestaande meetreeks of object voor nieuwe meetreeks..."
}) => {
    const [selectedOption, setSelectedOption] = useState<MeetreeksOptionItem | null>(value || null);

    const loadOptions = useCallback(async (inputValue: string): Promise<MeetreeksOptionItem[]> => {
        try {
            const options = await GetMeetreeksOptions(inputValue);
            if (!options) return [];

            return options.map((opt) => ({
                value: opt.key,
                label: opt.displayLabel,
                isNew: opt.isNew,
                objectId: opt.objectId,
                meetreeksId: opt.meetreeksId,
            }));
        } catch (error) {
            console.error("Fout bij zoeken van meetreeksen:", error);
            return [];
        }
    }, []);

    return (
        <div style={{ width: '100%', maxWidth: '600px' }}>
            <AsyncSelect<MeetreeksOptionItem>
                cacheOptions
                defaultOptions
                value={selectedOption}
                loadOptions={loadOptions}
                onChange={(option) => {
                    setSelectedOption(option);
                    onSelect(option);
                }}
                placeholder={placeholder}
                isClearable
                noOptionsMessage={({ inputValue }) => 
                    inputValue ? "Geen meetreeksen of objecten gevonden" : "Typ om te zoeken..."
                }
                loadingMessage={() => "Zoeken..."}
                
                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                menuPosition="fixed"
                
                styles={{
                    control: (base) => ({
                        ...base,
                        borderColor: '#ccc',
                        boxShadow: 'none',
                        backgroundColor: '#fff',
                        '&:hover': { borderColor: '#007acc' }
                    }),
                    option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isFocused ? '#e6f2ff' : '#ffffff',
                        color: '#333333',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '13px',
                    }),
                    singleValue: (base) => ({
                        ...base,
                        color: '#333333',
                    }),
                    menuPortal: (base) => ({
                        ...base,
                        zIndex: 9999
                    }),
                    menuList: (base) => ({
                        ...base,
                        maxHeight: '250px',
                        backgroundColor: '#ffffff',
                    })
                }}
            />
        </div>
    );
};