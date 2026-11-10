import React, { useEffect, useState } from 'react';
import * as AppBindings from '../../wailsjs/go/main/App';
import { main } from '../../wailsjs/go/models';
import { NodeSearchSelect } from './NodeSearchSelect';

interface RelationEditorProps {
  isOpen: boolean;
  relation: main.RelationValueEntity | null;
  fixedSourceId?: string; // Object is de Source (uitgaande relatie)
  fixedTargetId?: string; // Object is het Target (inkomende relatie)
  onClose: () => void;
  onSaved: () => void;
}

interface ObjectTypeOption {
  id: string;
  label: string;
}

export const RelationEditorModal: React.FC<RelationEditorProps> = ({
  isOpen,
  relation,
  fixedSourceId,
  fixedTargetId,
  onClose,
  onSaved,
}) => {
  const [relationTypes, setRelationTypes] = useState<main.RelationTypeEntity[]>([]);
  const [formData, setFormData] = useState<Partial<main.RelationValueEntity>>({});
  const [loading, setLoading] = useState<boolean>(false);

  const [sourceNode, setSourceNode] = useState<main.ObjectEntity | null>(null);
  const [targetNode, setTargetNode] = useState<main.ObjectEntity | null>(null);

  const [targetMode, setTargetMode] = useState<'EXISTING' | 'NEW'>('EXISTING');
  const [newObjectLabel, setNewObjectLabel] = useState<string>('');
  const [selectedObjectTypeID, setSelectedObjectTypeID] = useState<string>('');
  const [objectTypes, setObjectTypes] = useState<ObjectTypeOption[]>([]);

  // Nieuwe state voor de "Is bijlage" parameter op de relatie
  const [isBijlage, setIsBijlage] = useState<boolean>(false);
  const [existingBijlageParamValueId, setExistingBijlageParamValueId] = useState<string | null>(null);

  const resolveNode = async (id: string): Promise<main.ObjectEntity | null> => {
    if (!id) return null;
    try {
      if (typeof AppBindings.SearchNodesForSelect === 'function') {
        const results = await AppBindings.SearchNodesForSelect(id, 10);
        const match = results?.find((n: main.ObjectEntity) => n.id === id);
        if (match) return match;
      }
    } catch (e) {
      console.error('Fout bij ophalen node details:', e);
    }
    return new main.ObjectEntity({ id, label: `Object (${id.slice(0, 8)}...)` });
  };

  const fetchObjectTypes = async () => {
    try {
      const bindings = AppBindings as Record<string, any>;
      if (typeof bindings.GetObjectTypes === 'function') {
        const types = await bindings.GetObjectTypes();
        setObjectTypes(types || []);
      }
    } catch (e) {
      console.error('Fout bij ophalen objecttypen:', e);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    if (typeof AppBindings.GetAllRelationsTypes === 'function') {
      AppBindings.GetAllRelationsTypes().then((types: main.RelationTypeEntity[]) => {
        setRelationTypes(types || []);
      });
    }

    fetchObjectTypes();

    const initModal = async () => {
      setTargetMode('EXISTING');
      setNewObjectLabel('');
      setSelectedObjectTypeID('');

      if (relation) {
        setFormData({ ...relation });
        if (relation.sourceId) setSourceNode(await resolveNode(relation.sourceId));
        if (relation.targetId) setTargetNode(await resolveNode(relation.targetId));

        // Haal parameters op voor deze relatie om te controleren of 'Is bijlage' aan staat
        try {
          const params = await AppBindings.GetParametersForTarget(relation.id);
          const bijlageParam = params?.find(
            (p: main.ParameterValueEntity) => p.parameterId === '01a1c4fd-3206-757b-9aff-e2863256712a'
          );
          if (bijlageParam && (bijlageParam.value === '1' || bijlageParam.value === 'true')) {
            setIsBijlage(true);
            setExistingBijlageParamValueId(bijlageParam.id);
          } else {
            setIsBijlage(false);
            setExistingBijlageParamValueId(bijlageParam ? bijlageParam.id : null);
          }
        } catch (e) {
          console.error('Fout bij ophalen parameters voor relatie:', e);
          setIsBijlage(false);
          setExistingBijlageParamValueId(null);
        }
      } else {
        const activeSourceId = fixedSourceId || '';
        const activeTargetId = fixedTargetId || '';

        setFormData({
          id: '',
          relationId: '',
          sourceId: activeSourceId,
          targetId: activeTargetId,
          volgorde: 1,
          isConfidential: false,
          validFrom: new Date().toISOString().substring(0, 10),
        });

        setIsBijlage(false);
        setExistingBijlageParamValueId(null);

        if (activeSourceId) setSourceNode(await resolveNode(activeSourceId));
        if (activeTargetId) setTargetNode(await resolveNode(activeTargetId));
      }
    };

    initModal();
  }, [isOpen, relation, fixedSourceId, fixedTargetId]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const bindings = AppBindings as Record<string, any>;
      let finalSourceId = formData.sourceId || '';
      let finalTargetId = formData.targetId || '';

      // 1. ALS WE EEN NIEUW OBJECT AANMAKEN
      if (targetMode === 'NEW') {
        if (typeof bindings.CreateNewObject !== 'function') {
          alert('Fout: Go functie CreateNewObject is nog niet geëxporteerd/beschikbaar.');
          setLoading(false);
          return;
        }

        const createdObjId = await bindings.CreateNewObject(
          newObjectLabel.trim(),
          selectedObjectTypeID
        );

        if (fixedSourceId) {
          finalSourceId = fixedSourceId;
          finalTargetId = createdObjId;
        } else if (fixedTargetId) {
          finalSourceId = createdObjId;
          finalTargetId = fixedTargetId;
        }
      }

      // 2. OPSLAAN HOOFDRELATIE & VERKRIJG HET RELATIE-ID
      let savedRelId = formData.id || '';
      if (typeof bindings.SaveRelationValue === 'function') {
        const relationToSave = {
          ...formData,
          sourceId: finalSourceId,
          targetId: finalTargetId,
        };

        savedRelId = await bindings.SaveRelationValue(relationToSave);
      }

      // 3. OPSLAAN OF VERWIJDEREN VAN DE "IS BIJLAGE" PARAMETERWAARDE
      if (savedRelId) {
        const bijlageParameterID = '01a1c4fd-3206-757b-9aff-e2863256712a';
        if (isBijlage) {
          await bindings.SaveParameterValue({
            id: existingBijlageParamValueId || '',
            parameterId: bijlageParameterID,
            targetId: savedRelId,
            targetType: 'relation',
            value: '1',
            isConfidential: false,
            validFrom: formData.validFrom || new Date().toISOString().substring(0, 10),
            updatedAt: new Date().toISOString(),
          });
        } else if (existingBijlageParamValueId) {
          if (typeof bindings.DeleteParameterValue === 'function') {
            await bindings.DeleteParameterValue(existingBijlageParamValueId);
          }
        }
      }

      window.dispatchEvent(
        new CustomEvent('relations-updated', {
          detail: {
            sourceId: finalSourceId,
            targetId: finalTargetId,
          },
        })
      );

      onSaved();
      onClose();
    } catch (err) {
      console.error('Fout bij opslaan:', err);
      alert('Opslaan mislukt: ' + err);
    } finally {
      setLoading(false);
    }
  };

  const isEditingExisting = Boolean(formData.id);
  const canSave =
    !loading &&
    Boolean(formData.relationId) &&
    (targetMode === 'EXISTING'
      ? Boolean(formData.sourceId) && Boolean(formData.targetId)
      : Boolean(newObjectLabel.trim()) && Boolean(selectedObjectTypeID));

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }} onClick={onClose}>
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '520px', padding: '20px' }} onClick={(e) => e.stopPropagation()}>
        <h3>{formData.id ? 'Relatie Bewerken' : 'Nieuwe Relatie Toevoegen'}</h3>

        {/* RELATIETYPE */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold' }}>Relatietype:</label>
          <select style={{ width: '100%', padding: '6px' }} value={formData.relationId || ''} onChange={(e) => setFormData({ ...formData, relationId: e.target.value })}>
            <option value="">-- Selecteer Relatietype --</option>
            {relationTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* MODUS SELECTIE */}
        {!isEditingExisting && (
          <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', background: '#f5f5f5', padding: '8px', borderRadius: '4px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }}>
              <input type="radio" name="targetMode" value="EXISTING" checked={targetMode === 'EXISTING'} onChange={() => setTargetMode('EXISTING')} /> Bestaand Object Koppelen
            </label>
            <label style={{ fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }}>
              <input type="radio" name="targetMode" value="NEW" checked={targetMode === 'NEW'} onChange={() => setTargetMode('NEW')} /> Nieuw Object Aanmaken
            </label>
          </div>
        )}

        {/* FORMULIER INHOUD */}
        {targetMode === 'EXISTING' ? (
          <>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold' }}>Van (Source):</label>
              <NodeSearchSelect value={sourceNode} isDisabled={Boolean(fixedSourceId)} excludeNodeId={targetNode?.id} onSelectNode={(node) => { setSourceNode(node); setFormData(p => ({ ...p, sourceId: node?.id || '' })); }} />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold' }}>Naar (Target):</label>
              <NodeSearchSelect value={targetNode} isDisabled={Boolean(fixedTargetId)} excludeNodeId={sourceNode?.id} onSelectNode={(node) => { setTargetNode(node); setFormData(p => ({ ...p, targetId: node?.id || '' })); }} />
            </div>
          </>
        ) : (
          <div style={{ border: '1px solid #007acc', padding: '12px', borderRadius: '6px', marginBottom: '12px', backgroundColor: '#f0f8ff' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#007acc' }}>Details Nieuw Object</h4>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold' }}>Label Nieuw Object:</label>
              <input type="text" style={{ width: '100%', padding: '6px', boxSizing: 'border-box' }} value={newObjectLabel} onChange={(e) => setNewObjectLabel(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold' }}>Objecttype (Verplichte Ingaande Relatie):</label>
              <select style={{ width: '100%', padding: '6px' }} value={selectedObjectTypeID} onChange={(e) => setSelectedObjectTypeID(e.target.value)}>
                <option value="">-- Selecteer Objecttype --</option>
                {objectTypes.map((ot) => (
                  <option key={ot.id} value={ot.id}>{ot.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* IS BIJLAGE CHECKBOX */}
        <div style={{ marginTop: '14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '10px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
          <input
            type="checkbox"
            id="isBijlageCheckbox"
            checked={isBijlage}
            onChange={(e) => setIsBijlage(e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          <label htmlFor="isBijlageCheckbox" style={{ fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', color: '#1e293b' }}>
            Is bijlage (verdiepende informatie / achtergrond)
          </label>
        </div>

        {/* KNOPPEN */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <button onClick={onClose} style={{ padding: '6px 12px' }}>Annuleren</button>
          <button onClick={handleSave} disabled={!canSave} style={{ background: '#007acc', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', opacity: canSave ? 1 : 0.6 }}>
            {loading ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </div>
    </div>
  );
};