// src/components/NodeSearchSelect.tsx
import React, { useEffect, useState, useCallback } from 'react';
import AsyncSelect from 'react-select/async';
import { SearchNodesForSelect } from '../../wailsjs/go/main/App';
import { main } from '../../wailsjs/go/models';

export interface NodeOption {
    value: string;
    label: string;
    node: main.ObjectEntity;
}

interface Props {
    value?: main.ObjectEntity | null;
    onSelectNode: (node: main.ObjectEntity | null) => void;
    placeholder?: string;
    excludeNodeId?: string; // Om te voorkomen dat een node naar zichzelf kan linken
    excludePhotos?: boolean; // NEW: Negeer objecten waarvan het label start met FOTO:
    filterNode?: (node: main.ObjectEntity) => boolean; // NEW: Optionele maatwerk filter
    isDisabled?: boolean;
}

export const NodeSearchSelect: React.FC<Props> = ({ 
    value,
    onSelectNode, 
    placeholder = "Zoek en kies een node...",
    excludeNodeId,
    excludePhotos = false,
    filterNode,
    isDisabled = false
}) => {
    const [selectedOption, setSelectedOption] = useState<NodeOption | null>(null);

    // Sync externe prop-waarde naar interne react-select state
    useEffect(() => {
        if (value) {
            setSelectedOption({
                value: value.id,
                label: value.label || value.id,
                node: value,
            });
        } else {
            setSelectedOption(null);
        }
    }, [value]);

    const loadOptions = useCallback(async (inputValue: string): Promise<NodeOption[]> => {
        try {
            const nodes = await SearchNodesForSelect(inputValue, 50);
            if (!nodes) return [];

            return nodes
                .filter((node) => node.id !== excludeNodeId)
                .filter((node) => {
                    // Filter foto-nodes eruit als excludePhotos actief is
                    if (excludePhotos) {
                        const lbl = (node.label || '').trim().toUpperCase();
                        if (lbl.startsWith('FOTO:')) return false;
                    }
                    // Eventuele extra aangepaste filter
                    if (filterNode && !filterNode(node)) {
                        return false;
                    }
                    return true;
                })
                .map((node) => ({
                    value: node.id,
                    label: node.label || node.id,
                    node: node,
                }));
        } catch (error) {
            console.error("Fout bij zoeken van nodes:", error);
            return [];
        }
    }, [excludeNodeId, excludePhotos, filterNode]);

    return (
        <div style={{ width: '100%' }}>
            <AsyncSelect<NodeOption>
                cacheOptions
                defaultOptions
                isDisabled={isDisabled}
                value={selectedOption}
                loadOptions={loadOptions}
                onChange={(option) => {
                    setSelectedOption(option);
                    onSelectNode(option ? option.node : null);
                }}
                placeholder={placeholder}
                isClearable
                noOptionsMessage={({ inputValue }) => 
                    inputValue ? "Geen nodes gevonden" : "Typ om te zoeken..."
                }
                loadingMessage={() => "Zoeken..."}
                
                /* PORTAL CONFIGURATIE DIE DUBBELE SCROLLBALK VERHELPT */
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
                        fontSize: '12px',
                    }),
                    menuPortal: (base) => ({
                        ...base,
                        zIndex: 9999
                    }),
                    menuList: (base) => ({
                        ...base,
                        maxHeight: '250px'
                    })
                }}
            />
        </div>
    );
};