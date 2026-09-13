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
    isDisabled?: boolean;
}

export const NodeSearchSelect: React.FC<Props> = ({ 
    value,
    onSelectNode, 
    placeholder = "Zoek en kies een node...",
    excludeNodeId,
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
                .filter((node) => node.id !== excludeNodeId) // Optionele uitsluiting
                .map((node) => ({
                    value: node.id,
                    label: node.label || node.id,
                    node: node,
                }));
        } catch (error) {
            console.error("Fout bij zoeken van nodes:", error);
            return [];
        }
    }, [excludeNodeId]);

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
                        cursor: 'pointer'
                    })
                }}
            />
        </div>
    );
};