// src/components/ParameterSearchSelect.tsx
import React, { useState, useCallback } from 'react';
import AsyncSelect from 'react-select/async';
import { SearchParametersForSelect } from '../../wailsjs/go/main/App';

export interface ParameterOption {
  value: string;
  label: string;
  code: string;
  unit?: string;
  dataType?: string; 
}

interface Props {
  onSelect: (option: ParameterOption | null) => void;
  isDisabled?: boolean;
}

export const ParameterSearchSelect: React.FC<Props> = ({ onSelect, isDisabled }) => {
  const [selectedOption, setSelectedOption] = useState<ParameterOption | null>(null);

  const loadOptions = useCallback(async (inputValue: string): Promise<ParameterOption[]> => {
    try {
      const results = await SearchParametersForSelect(inputValue);
      if (!results) return [];

      return results.map((p) => ({
        value: p.id,
        label: `${p.label} (${p.code})`,
        code: p.code,
        unit: p.unit || undefined,
        dataType: p.dataType,
      }));
    } catch (err) {
      console.error("Fout bij zoeken van parameters:", err);
      return [];
    }
  }, []);

  return (
    <AsyncSelect<ParameterOption>
      cacheOptions
      defaultOptions
      isDisabled={isDisabled}
      value={selectedOption}
      loadOptions={loadOptions}
      onChange={(option) => {
        setSelectedOption(option);
        onSelect(option);
      }}
      placeholder="Zoek parameter..."
      isClearable
      noOptionsMessage={() => "Geen parameters gevonden"}
      
      /* PORTAL CONFIGURATIE VOOR GOEDE WEERGAVE BINNEN MODALS/CONTAINERS */
      menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
      menuPosition="fixed"

      styles={{
        control: (base) => ({
          ...base,
          borderColor: '#ccc',
          boxShadow: 'none',
          minHeight: '32px',
          backgroundColor: '#fff',
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
          zIndex: 9999,
        }),
        menuList: (base) => ({
          ...base,
          maxHeight: '250px',
          backgroundColor: '#ffffff',
        })
      }}
    />
  );
};