// src/modules/meetwaarden/MeetwaardenModule.tsx
import React, { useEffect, useState } from 'react';
import {
    GetParameterGroups,
    GetParametersForGroup,
    SaveParameterGroup,
    CreateMeetreeks,
    GetMeetwaardenForMeetreeks,
    SaveOrUpdateMeetwaardenRow,
    GetParametersForMeetreeks,
    GetPresentatieData
} from '../../../../frontend/wailsjs/go/main/App';
import { main } from '../../../../frontend/wailsjs/go/models';
import { ParameterSearchSelect, ParameterOption } from '../../components/ParameterSearchSelect';
import './MeetwaardenModule.css';
import { MeetreeksSearchSelect, MeetreeksOptionItem } from './MeetreeksSearchSelect';
import { RichTextEditorModal } from '../../../../frontend/src/components/RichTextEditorModal'; // Pas het pad aan indien nodig

interface ParameterGroup {
    id: string;
    label: string;
}

export const MeetwaardenModule: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'metingen' | 'parametergroepen' | 'presentatie'>('parametergroepen');

    // State voor parametergroepen beheer (Tab b)
    const [groups, setGroups] = useState<ParameterGroup[]>([]);
    const [selectedGroupID, setSelectedGroupID] = useState<string>('');
    const [groupLabel, setGroupLabel] = useState<string>('');
    const [groupParameters, setGroupParameters] = useState<main.ParameterDefinition[]>([]);
    const [isNewGroup, setIsNewGroup] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const [selectedMeetreeksOption, setSelectedMeetreeksOption] = useState<MeetreeksOptionItem | null>(null);
    // Laad bij starten de parametergroepen
    useEffect(() => {
        loadGroups();
    }, []);

    const loadGroups = async () => {
        try {
            const res = await GetParameterGroups();
            setGroups(res || []);
        } catch (err) {
            console.error("Fout bij ophalen parametergroepen:", err);
        }
    };


    const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
    const [targetObjectIdForNew, setTargetObjectIdForNew] = useState<string>('');
    const [targetObjectLabelForNew, setTargetObjectLabelForNew] = useState<string>('');
    const [newMeetreeksLabel, setNewMeetreeksLabel] = useState<string>('');
    const [parameterGroups, setParameterGroups] = useState<any[]>([]);
    const [selectedParamGroupId, setSelectedParamGroupId] = useState<string>('');



    // State voor Tab C (Presentatie & Analyse)
    const [presentatieTemplateJson, setPresentatieTemplateJson] = useState<string>(
        JSON.stringify({
            title: "Tijdreeks Analyse",
            codes: ["PH", "EC"],
            dateFrom: "",
            dateTo: ""
        }, null, 2)
    );
    const [presentatieResult, setPresentatieResult] = useState<any | null>(null);
    const [loadingPresentatie, setLoadingPresentatie] = useState<boolean>(false);
    // Wanneer een groep geselecteerd wordt
    const handleSelectGroup = async (id: string) => {
        setSelectedGroupID(id);
        if (!id) {
            setIsNewGroup(false);
            setGroupLabel('');
            setGroupParameters([]);
            return;
        }

        if (id === 'NEW') {
            setIsNewGroup(true);
            setGroupLabel('Nieuwe Parametergroep');
            setGroupParameters([]);
            return;
        }

        setIsNewGroup(false);
        const found = groups.find(g => g.id === id);
        if (found) setGroupLabel(found.label);

        setLoading(true);
        try {
            const params = await GetParametersForGroup(id);
            setGroupParameters(params || []);
        } catch (err) {
            console.error("Fout bij ophalen parameters voor groep:", err);
        } finally {
            setLoading(false);
        }
    };

    // Voeg parameter toe aan de lijst
    const handleAddParameter = (option: ParameterOption | null) => {
        if (!option) return;
        // Check of hij er al in staat
        if (groupParameters.some(p => p.id === option.value)) return;

        const newParam: main.ParameterDefinition = {
            id: option.value,
            label: option.label.split(' (')[0],
            code: option.code,
            dataType: option.dataType || 'number',
            unit: option.unit
        };

        setGroupParameters([...groupParameters, newParam]);
    };

    // Verwijder parameter uit lijst
    const handleRemoveParameter = (index: number) => {
        const updated = [...groupParameters];
        updated.splice(index, 1);
        setGroupParameters(updated);
    };

    // Verplaats parameter omhoog of omlaag
    const handleMove = (index: number, direction: 'up' | 'down') => {
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= groupParameters.length) return;

        const updated = [...groupParameters];
        const temp = updated[index];
        updated[index] = updated[targetIndex];
        updated[targetIndex] = temp;
        setGroupParameters(updated);
    };

    // Opslaan van de groep
    const handleSaveGroup = async () => {
        if (!groupLabel.trim()) {
            alert("Geef de parametergroep een naam.");
            return;
        }

        try {
            const parameterIds = groupParameters.map(p => p.id);
            const savedId = await SaveParameterGroup({
                groupId: isNewGroup ? '' : selectedGroupID,
                groupLabel: groupLabel,
                parameterIds: parameterIds
            });

            alert("Parametergroep succesvol opgeslagen!");
            await loadGroups();
            handleSelectGroup(savedId);
        } catch (err) {
            console.error("Fout bij opslaan parametergroep:", err);
            alert("Fout bij opslaan: " + err);
        }
    };

    // Extra states die je toevoegt aan de MeetwaardenModule component:
    const [activeMeetreeksID, setActiveMeetreeksID] = useState<string>('');
    const [activeMeetreeksLabel, setActiveMeetreeksLabel] = useState<string>('');
    const [meetwaardenParameters, setMeetwaardenParameters] = useState<main.ParameterDefinition[]>([]);
    const [meetwaardenRows, setMeetwaardenRows] = useState<any[]>([]);
    const [meetwaardenLimit, setMeetwaardenLimit] = useState<number>(25);
    const [loadingMeetwaarden, setLoadingMeetwaarden] = useState<boolean>(false);

    const loadMeetwaardenForSelectedMeetreeks = async (meetreeksId: string, limit: number) => {
        setLoadingMeetwaarden(true);
        try {
            // 1. Haal de gekoppelde parameters op voor deze meetreeks
            // (Dit kan via een dedicated Go-helperfunctie of direct via je bestaande logica)
            const params = await GetParametersForMeetreeks(meetreeksId); // Of via de parametergroep
            setMeetwaardenParameters(params || []);

            // 2. Haal de historische meetwaarden-sets op
            const rows = await GetMeetwaardenForMeetreeks(meetreeksId, limit);
            setMeetwaardenRows(rows || []);
        } catch (err) {
            console.error("Fout bij laden meetwaarden en parameters:", err);
        } finally {
            setLoadingMeetwaarden(false);
        }
    };

    // State voor de RichTextEditor modal in het werkblad
    const [editorModalOpen, setEditorModalOpen] = useState<boolean>(false);
    const [currentEditingCell, setCurrentEditingCell] = useState<{ rIdx: number; paramId: string; value: string; label: string } | null>(null);

    // Converteer UTC ISO string naar lokale YYYY-MM-DDTHH:mm voor de datetime-local input
    const formatIsoToLocalDateTime = (isoString: string) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return '';

        const pad = (n: number) => String(n).padStart(2, '0');
        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    // Converteer lokale datetime-local waarde terug naar UTC ISO string voor de database
    const formatLocalDateTimeToIso = (localValue: string) => {
        if (!localValue) return new Date().toISOString();
        const date = new Date(localValue); // JavaScript interpreteert dit automatisch als lokale tijd
        return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
    };


    return (
        <div className="meetwaarden-module-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px', boxSizing: 'border-box', backgroundColor: '#f9f9f9', overflowY: 'auto' }}>
            <div className="module-header" style={{ marginBottom: '20px' }}>
                <h2 style={{ margin: '0 0 10px 0', color: '#333' }}>Meetreeksen & Parametergroepen Beheer</h2>
                <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                    Beheer parametergroepen en voer samenhangende meetreeksen in en uit.
                </p>
            </div>

            {/* Tab Navigatie */}
            <div className="tab-navigation" style={{ display: 'flex', gap: '10px', borderBottom: '2px solid #ddd', paddingBottom: '10px', marginBottom: '20px' }}>
                <button
                    onClick={() => setActiveTab('parametergroepen')}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: activeTab === 'parametergroepen' ? '#007acc' : '#e0e0e0',
                        color: activeTab === 'parametergroepen' ? '#fff' : '#333',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '13px'
                    }}
                >
                    b. Parametergroepen toevoegen / wijzigen
                </button>

                <button
                    onClick={() => setActiveTab('metingen')}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: activeTab === 'metingen' ? '#007acc' : '#e0e0e0',
                        color: activeTab === 'metingen' ? '#fff' : '#333',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '13px'
                    }}
                >
                    a. Metingen invoeren / wijzigen
                </button>

                <button
                    onClick={() => setActiveTab('presentatie')}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: activeTab === 'presentatie' ? '#007acc' : '#e0e0e0',
                        color: activeTab === 'presentatie' ? '#fff' : '#333',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '13px'
                    }}
                >
                    c. Presentatievormen
                </button>
            </div>

            {/* Tab Inhoud */}
            <div className="tab-content" style={{ flex: 1, backgroundColor: '#fff', padding: '20px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>

                {/* TAB B: PARAMETERGROEPEN */}
                {activeTab === 'parametergroepen' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <h3>Parametergroepen Beheer</h3>
                            <p style={{ color: '#666', fontSize: '13px' }}>Selecteer een bestaande parametergroep of maak een nieuwe aan om de parameterset in te richten.</p>
                        </div>

                        {/* Selectie balk */}
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                            <select
                                value={selectedGroupID}
                                onChange={(e) => handleSelectGroup(e.target.value)}
                                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '300px', fontSize: '14px' }}
                            >
                                <option value="">-- Kies een parametergroep --</option>
                                <option value="NEW">➕ Nieuwe parametergroep toevoegen...</option>
                                {groups.map(g => (
                                    <option key={g.id} value={g.id}>{g.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Bewerkingsformulier (zichtbaar als er een groep is geselecteerd of nieuw) */}
                        {(selectedGroupID) && (
                            <div style={{ border: '1px solid #e0e0e0', padding: '20px', borderRadius: '6px', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Naam Parametergroep:</label>
                                    <input
                                        type="text"
                                        value={groupLabel}
                                        onChange={(e) => setGroupLabel(e.target.value)}
                                        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', maxWidth: '400px' }}
                                    />
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                                    <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Parameters in deze groep (op volgorde):</label>

                                    {/* Parameter toevoegen via zoekcomponent */}
                                    <div style={{ maxWidth: '400px', marginBottom: '10px' }}>
                                        <ParameterSearchSelect onSelect={handleAddParameter} />
                                    </div>

                                    {loading ? (
                                        <p>Parameters laden...</p>
                                    ) : (
                                        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', color: '#333' }}>
                                            <thead>
                                                <tr style={{ backgroundColor: '#f1f1f1', textAlign: 'left', fontSize: '12px', color: '#333' }}>
                                                    <th style={{ padding: '8px', borderBottom: '1px solid #ddd', width: '50px', color: '#333' }}>Volgorde</th>
                                                    <th style={{ padding: '8px', borderBottom: '1px solid #ddd', color: '#333' }}>Parameter Label</th>
                                                    <th style={{ padding: '8px', borderBottom: '1px solid #ddd', color: '#333' }}>Code</th>
                                                    <th style={{ padding: '8px', borderBottom: '1px solid #ddd', color: '#333' }}>Eenheid</th>
                                                    <th style={{ padding: '8px', borderBottom: '1px solid #ddd', width: '150px', color: '#333' }}>Acties</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {groupParameters.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                                                            Geen parameters gekoppeld aan deze groep.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    groupParameters.map((p, idx) => (
                                                        <tr key={p.id} style={{ borderBottom: '1px solid #eee', fontSize: '13px', backgroundColor: '#ffffff', color: '#333' }}>
                                                            <td style={{ padding: '8px', color: '#333' }}>{idx + 1}</td>
                                                            <td style={{ padding: '8px', fontWeight: 'bold', color: '#333' }}>{p.label}</td>
                                                            <td style={{ padding: '8px', color: '#555' }}>{p.code}</td>
                                                            <td style={{ padding: '8px', color: '#333' }}>{p.unit || '-'}</td>
                                                            <td style={{ padding: '8px', display: 'flex', gap: '5px' }}>
                                                                <button
                                                                    onClick={() => handleMove(idx, 'up')}
                                                                    disabled={idx === 0}
                                                                    style={{ padding: '2px 6px', cursor: 'pointer', backgroundColor: '#f8f9fa', border: '1px solid #ccc', color: '#333', borderRadius: '3px' }}
                                                                    title="Omhoog"
                                                                >
                                                                    ▲
                                                                </button>
                                                                <button
                                                                    onClick={() => handleMove(idx, 'down')}
                                                                    disabled={idx === groupParameters.length - 1}
                                                                    style={{ padding: '2px 6px', cursor: 'pointer', backgroundColor: '#f8f9fa', border: '1px solid #ccc', color: '#333', borderRadius: '3px' }}
                                                                    title="Omlaag"
                                                                >
                                                                    ▼
                                                                </button>
                                                                <button
                                                                    onClick={() => handleRemoveParameter(idx)}
                                                                    style={{ padding: '2px 6px', backgroundColor: '#ff4d4d', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                                                                    title="Verwijderen"
                                                                >
                                                                    ✕
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    )}
                                </div>

                                <div style={{ marginTop: '15px' }}>
                                    <button
                                        onClick={handleSaveGroup}
                                        style={{ padding: '10px 20px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
                                    >
                                        💾 Parametergroep Opslaan
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB A: METINGEN INVOEREN / WIJZIGEN */}
                {activeTab === 'metingen' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <h3>Metingen Invoeren en Wijzigen</h3>
                            <p style={{ color: '#666', fontSize: '13px' }}>Typ om te zoeken naar een bestaande meetreeks of selecteer een object om een nieuwe meetreeks te starten.</p>
                        </div>

                        {/* Als we NIET bezig zijn met een nieuwe meetreeks aan te maken, toon de zoekcomponent */}
                        {!isCreatingNew ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Selecteer Meetreeks of Object:</label>
                                <MeetreeksSearchSelect
                                    value={selectedMeetreeksOption}
                                    onSelect={async (option) => {
                                        setSelectedMeetreeksOption(option);
                                        if (!option) {
                                            setActiveMeetreeksID('');
                                            setActiveMeetreeksLabel('');
                                            setMeetwaardenRows([]);
                                            return;
                                        }

                                        if (!option.isNew && option.meetreeksId) {
                                            // Bestaande meetreeks geselecteerd: Laad werkblad data!
                                            setActiveMeetreeksID(option.meetreeksId);
                                            setActiveMeetreeksLabel(option.label);
                                            await loadMeetwaardenForSelectedMeetreeks(option.meetreeksId, meetwaardenLimit);
                                        } else if (option.isNew) {
                                            // Reset werkblad bij starten nieuwe meetreeks
                                            setActiveMeetreeksID('');
                                            setActiveMeetreeksLabel('');
                                            setMeetwaardenRows([]);

                                            // Activeer de nieuwe meetreeks invoer-card
                                            setTargetObjectIdForNew(option.objectId);
                                            setTargetObjectLabelForNew(option.label.split(' : ')[0]);
                                            setNewMeetreeksLabel(`${option.label.split(' : ')[0]} - Meetreeks 1`);

                                            // Laad direct de parametergroepen in
                                            try {
                                                const groups = await GetParameterGroups();
                                                setParameterGroups(groups || []);
                                                if (groups && groups.length > 0) {
                                                    setSelectedParamGroupId(groups[0].id);
                                                }
                                            } catch (err) {
                                                console.error("Fout bij ophalen parametergroepen:", err);
                                            }

                                            setIsCreatingNew(true);
                                        }
                                    }}
                                />
                            </div>
                        ) : (
                            /* NETJES GEFORMATTEERD FORMULIER VOOR NIEUWE MEETREEKS */
                            <div style={{ border: '1px solid #007acc', padding: '20px', borderRadius: '6px', backgroundColor: '#f0f8ff', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <h4 style={{ margin: '0', color: '#007acc' }}>Nieuwe meetreeks aanmaken</h4>
                                <p style={{ margin: 0, fontSize: '13px', color: '#555' }}>
                                    Doelobject: <strong>{targetObjectLabelForNew}</strong>
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    <label style={{ fontWeight: 'bold', fontSize: '12px' }}>Label / Naam Meetreeks:</label>
                                    <input
                                        type="text"
                                        value={newMeetreeksLabel}
                                        onChange={(e) => setNewMeetreeksLabel(e.target.value)}
                                        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', backgroundColor: '#fff', color: '#333' }}
                                    />
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    <label style={{ fontWeight: 'bold', fontSize: '12px' }}>Kies Parametergroep:</label>
                                    <select
                                        value={selectedParamGroupId}
                                        onChange={(e) => setSelectedParamGroupId(e.target.value)}
                                        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', backgroundColor: '#fff', color: '#333' }}
                                    >
                                        {parameterGroups.map((g) => (
                                            <option key={g.id} value={g.id}>
                                                {g.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                    <button
                                        onClick={async () => {
                                            if (!newMeetreeksLabel.trim()) {
                                                alert("Geef een geldig label op.");
                                                return;
                                            }
                                            if (!selectedParamGroupId) {
                                                alert("Selecteer een parametergroep.");
                                                return;
                                            }

                                            try {
                                                const newId = await CreateMeetreeks({
                                                    objectId: targetObjectIdForNew,
                                                    meetreeksLabel: newMeetreeksLabel,
                                                    parameterGroupId: selectedParamGroupId
                                                });

                                                alert(`Nieuwe meetreeks succesvol aangemaakt! (ID: ${newId})`);
                                                setIsCreatingNew(false);
                                                setSelectedMeetreeksOption(null);
                                            } catch (err) {
                                                alert("Fout bij aanmaken meetreeks: " + err);
                                            }
                                        }}
                                        style={{ padding: '8px 16px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
                                    >
                                        💾 Meetreeks Opslaan
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsCreatingNew(false);
                                            setSelectedMeetreeksOption(null);
                                        }}
                                        style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                                    >
                                        Annuleren
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* WERKBLAD (DEEL B): ZODRA EEN MEETREEKS IS GESELECTEERD */}
                        {activeMeetreeksID && (
                            <div style={{ marginTop: '10px', borderTop: '2px solid #007acc', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h4 style={{ margin: '0 0 5px 0', color: '#007acc' }}>Werkblad: {activeMeetreeksLabel}</h4>
                                        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                                            Voeg meetwaarden toe, vul ontbrekende waarden aan of corrigeer meetmomenten.
                                        </p>
                                    </div>

                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Toon:</label>
                                        <select
                                            value={meetwaardenLimit}
                                            onChange={async (e) => {
                                                const lim = Number(e.target.value);
                                                setMeetwaardenLimit(lim);
                                                await loadMeetwaardenForSelectedMeetreeks(activeMeetreeksID, lim);
                                            }}
                                            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '12px', backgroundColor: '#fff', color: '#333' }}
                                        >
                                            <option value={10}>Laatste 10</option>
                                            <option value={25}>Laatste 25</option>
                                            <option value={50}>Laatste 50</option>
                                            <option value={0}>Alle metingen</option>
                                        </select>

                                        <button
                                            onClick={() => {
                                                const nowISO = new Date().toISOString(); // Wordt door de helper straks netjes lokaal getoond
                                                const newRow = {
                                                    id: '',
                                                    timestamp: nowISO,
                                                    values: {}
                                                };
                                                setMeetwaardenRows([newRow, ...meetwaardenRows]);
                                            }}
                                            style={{ padding: '6px 12px', backgroundColor: '#007acc', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
                                        >
                                            ➕ Nieuwe meting toevoegen
                                        </button>
                                    </div>
                                </div>

                                {loadingMeetwaarden ? (
                                    <p>Meetwaarden inladen...</p>
                                ) : (
                                    <div style={{ maxHeight: '350px', overflowY: 'auto', overflowX: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', color: '#333', fontSize: '13px' }}>
                                            <thead>
                                                <tr style={{ backgroundColor: '#f1f1f1', textAlign: 'left' }}>
                                                    {/* STICKY LINKSBOVEN: Meetmoment */}
                                                    <th style={{
                                                        position: 'sticky',
                                                        top: 0,
                                                        left: 0,
                                                        zIndex: 4,
                                                        backgroundColor: '#f1f1f1',
                                                        padding: '8px',
                                                        borderBottom: '1px solid #ddd',
                                                        width: '200px',
                                                        color: '#333',
                                                        boxShadow: '2px 2px 5px rgba(0,0,0,0.05)'
                                                    }}>
                                                        Meetmoment (T)
                                                    </th>

                                                    {/* PARAMETER KOPPEN */}
                                                    {meetwaardenParameters.map((p) => {
                                                        const isMarkdown = p.dataType === 'markdown';
                                                        return (
                                                            <th key={p.id} style={{
                                                                position: 'sticky',
                                                                top: 0,
                                                                zIndex: 2,
                                                                backgroundColor: '#f1f1f1',
                                                                padding: '8px',
                                                                borderBottom: '1px solid #ddd',
                                                                color: '#333',
                                                                whiteSpace: 'nowrap'
                                                            }}>
                                                                {p.label} {p.unit ? `(${p.unit})` : ''} {isMarkdown ? ' 📝' : ''}
                                                            </th>
                                                        );
                                                    })}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {meetwaardenRows.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={meetwaardenParameters.length + 1} style={{ padding: '30px', textAlign: 'center', color: '#888' }}>
                                                            Nog geen meetwaarden aanwezig in deze meetreeks. Klik op "Nieuwe meting toevoegen" om te starten.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    meetwaardenRows.map((row, rIdx) => (
                                                        <tr key={row.id || `new-${rIdx}`} style={{ borderBottom: '1px solid #eee' }}>
                                                            {/* STICKY LINKER DATA-CEL: Meetmoment (met auto-save bij verlaten) */}
                                                            <td style={{
                                                                position: 'sticky',
                                                                left: 0,
                                                                zIndex: 1,
                                                                backgroundColor: '#fff',
                                                                padding: '6px',
                                                                boxShadow: '2px 0 5px rgba(0,0,0,0.05)'
                                                            }}>
                                                                <input
                                                                    type="datetime-local"
                                                                    value={formatIsoToLocalDateTime(row.timestamp)}
                                                                    onChange={(e) => {
                                                                        const updated = [...meetwaardenRows];
                                                                        updated[rIdx].timestamp = formatLocalDateTimeToIso(e.target.value);
                                                                        setMeetwaardenRows(updated);
                                                                    }}
                                                                    onBlur={async () => {
                                                                        // Automatisch opslaan op de achtergrond bij verlaten van het veld
                                                                        try {
                                                                            const savedId = await SaveOrUpdateMeetwaardenRow({
                                                                                recordId: row.id || '',
                                                                                meetreeksId: activeMeetreeksID,
                                                                                timestamp: row.timestamp,
                                                                                values: row.values
                                                                            });
                                                                            if (!row.id && savedId) {
                                                                                const updated = [...meetwaardenRows];
                                                                                updated[rIdx].id = savedId;
                                                                                setMeetwaardenRows(updated);
                                                                            }
                                                                        } catch (err) {
                                                                            console.error("Fout bij achtergrond-opslaan tijdstip:", err);
                                                                        }
                                                                    }}
                                                                    style={{ padding: '4px', width: '100%', border: '1px solid #ccc', borderRadius: '3px', fontSize: '12px', backgroundColor: '#fff', color: '#333' }}
                                                                />
                                                            </td>

                                                            {/* DYNAMISCHE PARAMETER KOLOMMEN */}
                                                            {meetwaardenParameters.map((param) => {
                                                                const isMarkdown = param.dataType === 'markdown';
                                                                const cellValue = row.values[param.id] || '';

                                                                return (
                                                                    <td key={param.id} style={{ padding: '6px' }}>
                                                                        {isMarkdown ? (
                                                                            /* MARKDOWN: Open de RichTextEditorModal */
                                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '5px' }}>
                                                                                <span style={{ fontSize: '11px', color: '#666', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }}>
                                                                                    {cellValue ? (cellValue.replace(/<[^>]*>?/gm, '').substring(0, 20) + '...') : '[Leeg / tekst]'}
                                                                                </span>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setCurrentEditingCell({
                                                                                            rIdx: rIdx,
                                                                                            paramId: param.id,
                                                                                            value: cellValue,
                                                                                            label: param.label
                                                                                        });
                                                                                        setEditorModalOpen(true);
                                                                                    }}
                                                                                    style={{ padding: '4px 8px', backgroundColor: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd', borderRadius: '3px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                                                                                >
                                                                                    📝 Bewerk
                                                                                </button>
                                                                            </div>
                                                                        ) : (
                                                                            /* STANDAARD TEKSTVELD met auto-save (`onBlur`) */
                                                                            <input
                                                                                type="text"
                                                                                value={cellValue}
                                                                                placeholder="Leeg / in analyse"
                                                                                onChange={(e) => {
                                                                                    const updated = [...meetwaardenRows];
                                                                                    if (!updated[rIdx].values) updated[rIdx].values = {};
                                                                                    updated[rIdx].values[param.id] = e.target.value;
                                                                                    setMeetwaardenRows(updated);
                                                                                }}
                                                                                onBlur={async () => {
                                                                                    try {
                                                                                        const savedId = await SaveOrUpdateMeetwaardenRow({
                                                                                            recordId: row.id || '',
                                                                                            meetreeksId: activeMeetreeksID,
                                                                                            timestamp: row.timestamp,
                                                                                            values: row.values
                                                                                        });
                                                                                        // Als het een nieuwe rij was, slaan we het gegenereerde ID direct op in state
                                                                                        if (!row.id && savedId) {
                                                                                            const updated = [...meetwaardenRows];
                                                                                            updated[rIdx].id = savedId;
                                                                                            setMeetwaardenRows(updated);
                                                                                        }
                                                                                    } catch (err) {
                                                                                        console.error("Fout bij achtergrond-opslaan cel:", err);
                                                                                    }
                                                                                }}
                                                                                style={{ padding: '4px', width: '100%', border: '1px solid #ccc', borderRadius: '3px', fontSize: '12px', backgroundColor: '#fff', color: '#333' }}
                                                                            />
                                                                        )}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {!isCreatingNew && !activeMeetreeksID && (
                            <div style={{ padding: '30px', textAlign: 'center', border: '2px dashed #ccc', borderRadius: '6px', color: '#888' }}>
                                [ Selecteer een bestaande meetreeks hierboven om het werkblad te openen, of kies een object om een nieuwe meetreeks te starten. ]
                            </div>
                        )}
                    </div>
                )}
                {activeTab === 'presentatie' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <h3>Presentatievormen & Analyse</h3>
                            <p style={{ color: '#666', fontSize: '13px' }}>
                                Koppel een JSON-template met parameter_codes aan de actieve meetreeks om direct tabellen en grafieken te genereren.
                            </p>
                        </div>

                        {/* Configuratie Card */}
                        <div style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '6px', backgroundColor: '#fcfcfc', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '800px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Actieve Meetreeks ID:</label>
                                <span style={{ fontSize: '13px', color: activeMeetreeksID ? '#007acc' : '#d9534f', fontWeight: 'bold' }}>
                                    {activeMeetreeksID ? `${activeMeetreeksLabel} (${activeMeetreeksID})` : '⚠️ Geen meetreeks actief. Selecteer eerst een meetreeks in tab (a).'}
                                </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Template JSON Definitie:</label>
                                <textarea
                                    rows={6}
                                    value={presentatieTemplateJson}
                                    onChange={(e) => setPresentatieTemplateJson(e.target.value)}
                                    style={{ fontFamily: 'monospace', fontSize: '12px', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#fff', color: '#333' }}
                                />
                            </div>

                            <div>
                                <button
                                    disabled={!activeMeetreeksID}
                                    onClick={async () => {
                                        if (!activeMeetreeksID) return;
                                        setLoadingPresentatie(true);
                                        try {
                                            const res = await GetPresentatieData(activeMeetreeksID, presentatieTemplateJson);
                                            setPresentatieResult(res);
                                        } catch (err) {
                                            alert("Fout bij ophalen presentatiedata: " + err);
                                        } finally {
                                            setLoadingPresentatie(false);
                                        }
                                    }}
                                    style={{ padding: '8px 16px', backgroundColor: activeMeetreeksID ? '#007acc' : '#cccccc', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: activeMeetreeksID ? 'pointer' : 'not-allowed', fontSize: '13px' }}
                                >
                                    📊 Genereer Presentatie
                                </button>
                            </div>
                        </div>

                        {/* Resultaat Sectie (Tabel en Grafiek onder elkaar) */}
                        {loadingPresentatie && <p>Gegevens verwerken...</p>}

                        {presentatieResult && !loadingPresentatie && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', marginTop: '10px' }}>

                                {/* Titel */}
                                <div style={{ borderBottom: '2px solid #007acc', paddingBottom: '8px' }}>
                                    <h4 style={{ margin: 0, color: '#007acc' }}>{presentatieResult.title}</h4>
                                    <span style={{ fontSize: '12px', color: '#666' }}>Geselecteerde codes: {presentatieResult.codes.join(', ')}</span>
                                </div>

                                {/* 1. GRAFIEK (Eenvoudige responsieve SVG lijngrafiek) */}
                                <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '6px', backgroundColor: '#fff' }}>
                                    <h5 style={{ margin: '0 0 10px 0', color: '#333' }}>Visuele Trend (Grafiek)</h5>
                                    {(!presentatieResult.points || presentatieResult.points.length === 0) ? (
                                        <p style={{ color: '#888', fontSize: '13px' }}>Geen datapunten binnen de selectie.</p>
                                    ) : (
                                        <div style={{ width: '100%', height: '200px', position: 'relative', borderLeft: '1px solid #999', borderBottom: '1px solid #999' }}>
                                            {/* SVG Lijnweergave met vaste aspect ratio en pixel-coördinaten */}
                                            <svg viewBox="0 0 800 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                                                {presentatieResult.codes.map((code: string, cIdx: number) => {
                                                    const colors = ['#007acc', '#28a745', '#dc3545', '#ffc107', '#6f42c1'];
                                                    const color = colors[cIdx % colors.length];

                                                    const points = presentatieResult.points;
                                                    if (points.length < 2) return null;

                                                    // Zoek min en max voor Y-as schaling
                                                    let minVal = Infinity;
                                                    let maxVal = -Infinity;
                                                    points.forEach((pt: any) => {
                                                        const vals = pt.values || pt.Values || {};
                                                        const v = Number(vals[code]);
                                                        if (!isNaN(v)) {
                                                            if (v < minVal) minVal = v;
                                                            if (v > maxVal) maxVal = v;
                                                        }
                                                    });

                                                    if (minVal === Infinity) {
                                                        minVal = 0;
                                                        maxVal = 100;
                                                    }
                                                    if (minVal === maxVal) { minVal -= 1; maxVal += 1; }

                                                    const range = maxVal - minVal;
                                                    const svgWidth = 800;
                                                    const svgHeight = 200;
                                                    const padding = 20; // Ruimte rondom indien gewenst

                                                    // Genereer coördinaten binnen een schaal van 800x200 pixels
                                                    const coords = points.map((pt: any, idx: number) => {
                                                        const x = (idx / (points.length - 1)) * svgWidth;
                                                        const vals = pt.values || pt.Values || {};
                                                        const v = Number(vals[code]);
                                                        // Y-as loopt van onder (svgHeight) naar boven (0)
                                                        const y = !isNaN(v) ? svgHeight - ((v - minVal) / range) * (svgHeight - padding) : svgHeight / 2;
                                                        return `${x},${y}`;
                                                    }).join(' ');

                                                    return (
                                                        <g key={code}>
                                                            <polyline
                                                                fill="none"
                                                                stroke={color}
                                                                strokeWidth="2"
                                                                points={coords}
                                                            />
                                                            {/* Legenda label in vaste pixel-afmetingen */}
                                                            <text x="10" y={20 + (cIdx * 16)} fill={color} fontSize="12" fontWeight="bold">
                                                                ■ {code}
                                                            </text>
                                                        </g>
                                                    );
                                                })}
                                            </svg>
                                        </div>
                                    )}
                                </div>

                                {/* 2. TABEL */}
                                <div style={{ border: '1px solid #ddd', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#fff' }}>
                                    <h5 style={{ margin: '15px 15px 10px 15px', color: '#333' }}>Resultaten Tabel</h5>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: '#f1f1f1', textAlign: 'left' }}>
                                                <th style={{ padding: '8px 12px', borderBottom: '1px solid #ddd', color: '#333' }}>Meetmoment (T)</th>
                                                {presentatieResult.codes.map((code: string) => (
                                                    <th key={code} style={{ padding: '8px 12px', borderBottom: '1px solid #ddd', color: '#333' }}>
                                                        {code}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {presentatieResult.points.map((pt: any, idx: number) => {
                                                const ts = pt.timestamp;
                                                const vals = pt.values || {};

                                                return (
                                                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                                        <td style={{ padding: '8px 12px', color: '#333', fontWeight: '500' }}>
                                                            {ts ? new Date(ts).toLocaleString() : '-'}
                                                        </td>
                                                        {presentatieResult.codes.map((code: string) => (
                                                            <td key={code} style={{ padding: '8px 12px', color: '#333' }}>
                                                                {vals[code] !== undefined && vals[code] !== null ? vals[code] : '-'}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                            </div>
                        )}
                    </div>
                )}
                {/* Modal voor bewerken van Markdown / RichText waarden vanuit het werkblad */}
                {editorModalOpen && currentEditingCell && (
                    <RichTextEditorModal
                        isOpen={editorModalOpen}
                        onClose={() => {
                            setEditorModalOpen(false);
                            setCurrentEditingCell(null);
                        }}
                        initialValue={currentEditingCell.value}
                        title={`Bewerken: ${currentEditingCell.label}`}
                        onSave={(htmlContent) => {
                            const updated = [...meetwaardenRows];
                            if (!updated[currentEditingCell.rIdx].values) {
                                updated[currentEditingCell.rIdx].values = {};
                            }
                            updated[currentEditingCell.rIdx].values[currentEditingCell.paramId] = htmlContent;
                            setMeetwaardenRows(updated);
                            setEditorModalOpen(false);
                            setCurrentEditingCell(null);
                        }}
                    />
                )}
            </div>
        </div>
    );
};

export default MeetwaardenModule;