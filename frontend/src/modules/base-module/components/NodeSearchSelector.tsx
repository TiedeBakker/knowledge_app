// src/modules/base-module/components/NodeSearchSelector.tsx
import { useState, useMemo, useRef, useEffect } from 'react';
import { filterAndRankObjects, SearchableObject } from '../utils/searchUtils';

interface NodeSearchSelectorProps<T extends SearchableObject> {
  items: T[];
  selectedId: string | null;
  onSelect: (item: T) => void;
  placeholder?: string;
}

export function NodeSearchSelector<T extends SearchableObject>({
  items,
  selectedId,
  onSelect,
  placeholder = 'Zoek op label... (bijv. Testfilter##foto|video)',
}: NodeSearchSelectorProps<T>) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedObject = useMemo(
    () => items.find((item) => item.id === selectedId),
    [items, selectedId]
  );

  const filteredResults = useMemo(
    () => filterAndRankObjects(items, query),
    [items, query]
  );

  const activeExclusions = useMemo(() => {
    const parts = query.split('##');
    if (parts.length < 2 || !parts[1].trim()) return [];
    return parts[1].split('|').map((s) => s.trim()).filter(Boolean);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '340px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <input
          type="text"
          value={isOpen ? query : selectedObject ? selectedObject.label : query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          style={{
            padding: '7px 10px',
            fontSize: '0.85rem',
            color: '#1a1a1a', // Donkere, goed leesbare tekst
            backgroundColor: '#ffffff',
            borderRadius: '4px',
            border: '1px solid #767676', // Duidelijk zichtbare rand
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box',
          }}
        />

        {/* Visuele feedback voor uitsluitingsfilters met hoog contrast */}
        {activeExclusions.length > 0 && (
          <div style={{ fontSize: '0.75rem', color: '#b30000', fontWeight: 600, display: 'flex', gap: '4px' }}>
            <span>Uitzonderingen:</span>
            <span>{activeExclusions.join(', ')}</span>
          </div>
        )}
      </div>

      {/* Dropdown Resultatenlijst */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            maxHeight: '280px',
            overflowY: 'auto',
            backgroundColor: '#ffffff',
            border: '1px solid #555555',
            borderRadius: '0 0 4px 4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            zIndex: 1000,
            marginTop: '2px',
          }}
        >
          {filteredResults.length > 0 ? (
            filteredResults.map((item) => {
              const isSelected = item.id === selectedId;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelect(item);
                    setQuery(item.label);
                    setIsOpen(false);
                  }}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    borderBottom: '1px solid #e0e0e0',
                    // Hoge contrast-instellingen voor selectie
                    backgroundColor: isSelected ? '#005fb8' : '#ffffff',
                    color: isSelected ? '#ffffff' : '#1a1a1a',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = '#eef2f6';
                      (e.currentTarget as HTMLElement).style.color = '#000000';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = '#ffffff';
                      (e.currentTarget as HTMLElement).style.color = '#1a1a1a';
                    }
                  }}
                >
                  <span style={{ fontWeight: isSelected ? 600 : 400 }}>
                    {item.label}
                  </span>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      color: isSelected ? '#e0e0e0' : '#555555',
                      fontFamily: 'monospace',
                    }}
                  >
                    {item.id.slice(0, 8)}...
                  </span>
                </div>
              );
            })
          ) : (
            <div style={{ padding: '12px', fontSize: '0.85rem', color: '#333333', textAlign: 'center', backgroundColor: '#f9f9f9' }}>
              Geen objecten gevonden voor deze filtercombinatie.
            </div>
          )}
        </div>
      )}
    </div>
  );
}