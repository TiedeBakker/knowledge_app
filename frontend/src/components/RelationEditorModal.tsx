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

/**
 * Herordent en hernummert een reeks uitgaande relaties.
 * Voorbeeld: [0, 0, 0, 2, 4, 4, 0, 5] -> [2, 4, 4, 5, 0, 0, 0, 0] -> [1, 2, 3, 4, 5, 6, 7, 8]
 */
export const resequenceOutgoingRelations = (relations: main.RelationValueEntity[]): main.RelationValueEntity[] => {
  const sorted = [...relations].sort((a, b) => {
    const orderA = a.volgorde || 0;
    const orderB = b.volgorde || 0;

    if (orderA > 0 && orderB > 0) {
      return orderA - orderB;
    }
    if (orderA > 0 && orderB <= 0) {
      return -1;
    }
    if (orderA <= 0 && orderB > 0) {
      return 1;
    }
    return 0;
  });

  return sorted.map((rel, index) => ({
    ...rel,
    volgorde: index + 1,
  }));
};

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

  // Helper om een node op te halen
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
    return new main.ObjectEntity({ id, label: id });
  };

  // Haalt bestaande relaties op via de beschikbare Wails backend methodes
  const fetchRelationsForNode = async (nodeId: string): Promise<main.RelationValueEntity[]> => {
    const bindings = AppBindings as Record<string, any>;

    try {
      if (typeof bindings.GetRelationsForSource === 'function') {
        return await bindings.GetRelationsForSource(nodeId);
      }
      if (typeof bindings.GetRelationsForTarget === 'function') {
        return await bindings.GetRelationsForTarget(nodeId);
      }
      if (typeof bindings.GetRelations === 'function') {
        return await bindings.GetRelations(nodeId);
      }
      if (typeof bindings.GetRelationsByObjectId === 'function') {
        return await bindings.GetRelationsByObjectId(nodeId);
      }
    } catch (e) {
      console.error('Fout bij ophalen relaties via backend:', e);
    }
    return [];
  };

  // Bepaal het eerstvolgende volgordenummer voor uitgaande relaties van de geselecteerde source
  const calculateNextSequence = async (sourceId: string): Promise<number> => {
    if (!sourceId) return 1;
    try {
      const existingRelations = await fetchRelationsForNode(sourceId);

      // Filter uitsluitend de uitgaande relaties (waar het geselecteerde object de source is)
      const outgoing = (existingRelations || []).filter((r) => r.sourceId === sourceId);

      if (outgoing.length === 0) return 1;

      // Hernummer de huidige lijst volgens de logica (positieve waarden eerst, nullen achteraan)
      const resequenced = resequenceOutgoingRelations(outgoing);

      // Werk database bij indien er correcties plaatsvonden
      const needsUpdate = outgoing.some((orig, idx) => orig.volgorde !== resequenced[idx].volgorde);
      if (needsUpdate && typeof AppBindings.SaveRelationValue === 'function') {
        await Promise.all(resequenced.map((rel) => AppBindings.SaveRelationValue(rel)));
      }

      return resequenced.length + 1;
    } catch (e) {
      console.error('Fout bij hernummeren volgorde op source:', e);
      return 1;
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    if (typeof AppBindings.GetAllRelationsTypes === 'function') {
      AppBindings.GetAllRelationsTypes().then((types: main.RelationTypeEntity[]) => {
        setRelationTypes(types || []);
      });
    }

    const initModal = async () => {
      if (relation) {
        setFormData({ ...relation });

        if (relation.sourceId) {
          const src = await resolveNode(relation.sourceId);
          setSourceNode(src);
        } else {
          setSourceNode(null);
        }

        if (relation.targetId) {
          const tgt = await resolveNode(relation.targetId);
          setTargetNode(tgt);
        } else {
          setTargetNode(null);
        }
      } else {
        const activeSourceId = fixedSourceId || '';
        const activeTargetId = fixedTargetId || '';

        const nextOrder = activeSourceId ? await calculateNextSequence(activeSourceId) : 1;

        setFormData({
          id: '',
          relationId: '',
          sourceId: activeSourceId,
          targetId: activeTargetId,
          volgorde: nextOrder,
          isConfidential: false,
          validFrom: new Date().toISOString().substring(0, 10),
        });

        if (activeSourceId) {
          const src = await resolveNode(activeSourceId);
          setSourceNode(src);
        } else {
          setSourceNode(null);
        }

        if (activeTargetId) {
          const tgt = await resolveNode(activeTargetId);
          setTargetNode(tgt);
        } else {
          setTargetNode(null);
        }
      }
    };

    initModal();
  }, [isOpen, relation, fixedSourceId, fixedTargetId]);

  const handleTargetChange = async (node: main.ObjectEntity | null) => {
    setTargetNode(node);
    const newTargetId = node?.id || '';

    let newOrder = formData.volgorde;
    if (!formData.id && formData.sourceId) {
      newOrder = await calculateNextSequence(formData.sourceId);
    }

    setFormData((prev) => ({
      ...prev,
      targetId: newTargetId,
      volgorde: newOrder,
    }));
  };

  const handleSourceChange = async (node: main.ObjectEntity | null) => {
    setSourceNode(node);
    const newSourceId = node?.id || '';

    let newOrder = formData.volgorde;
    if (!formData.id && newSourceId) {
      newOrder = await calculateNextSequence(newSourceId);
    }

    setFormData((prev) => ({
      ...prev,
      sourceId: newSourceId,
      volgorde: newOrder,
    }));
  };

  if (!isOpen) return null;

  const handleSave = async () => {
    setLoading(true);
    try {
      if (typeof AppBindings.SaveRelationValue === 'function') {
        await AppBindings.SaveRelationValue(formData as main.RelationValueEntity);
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error('Fout bij opslaan relatie:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!formData.id || !window.confirm('Weet je zeker dat je deze relatie wilt verwijderen?')) return;
    setLoading(true);
    try {
      if (typeof AppBindings.DeleteRelationValue === 'function') {
        await AppBindings.DeleteRelationValue(formData.id);
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error('Fout bij verwijderen relatie:', err);
    } finally {
      setLoading(false);
    }
  };

  const isIncomingOnly = Boolean(fixedTargetId && !fixedSourceId);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          width: '500px',
          padding: '20px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{formData.id ? 'Relatie Bewerken' : 'Nieuwe Relatie Toevoegen'}</h3>

        {/* RELATIE TYPE DROPDOWN */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
            Relatietype:
          </label>
          <select
            style={{ width: '100%', padding: '6px' }}
            value={formData.relationId || ''}
            onChange={(e) => setFormData({ ...formData, relationId: e.target.value })}
          >
            <option value="">-- Selecteer Relatietype --</option>
            {relationTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* BRON OBJECT (SOURCE) */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
            Van (Source):
          </label>
          <NodeSearchSelect
            value={sourceNode}
            isDisabled={Boolean(fixedSourceId)}
            excludeNodeId={targetNode?.id}
            placeholder="Zoek en kies bron-node..."
            onSelectNode={handleSourceChange}
          />
        </div>

        {/* DOEL OBJECT (TARGET) */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
            Naar (Target):
          </label>
          <NodeSearchSelect
            value={targetNode}
            isDisabled={Boolean(fixedTargetId)}
            excludeNodeId={sourceNode?.id}
            placeholder="Zoek en kies doel-node..."
            onSelectNode={handleTargetChange}
          />
        </div>

        {/* VOLGORDE & VERTROUWELIJK */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
              Volgorde op source:
            </label>
            <input
              type="number"
              style={{
                width: '100%',
                padding: '6px',
                backgroundColor: isIncomingOnly ? '#f0f0f0' : '#fff',
              }}
              disabled={isIncomingOnly}
              value={formData.volgorde || 1}
              onChange={(e) => setFormData({ ...formData, volgorde: parseInt(e.target.value, 10) || 1 })}
            />
            {isIncomingOnly && (
              <span style={{ fontSize: '0.7rem', color: '#666' }}>
                Wordt automatisch achteraan geplaatst bij de bron-node.
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '16px' }}>
            <input
              type="checkbox"
              id="relConfidential"
              checked={Boolean(formData.isConfidential)}
              onChange={(e) => setFormData({ ...formData, isConfidential: e.target.checked })}
            />
            <label htmlFor="relConfidential" style={{ marginLeft: '6px', fontSize: '0.85rem' }}>
              Vertrouwelijk
            </label>
          </div>
        </div>

        {/* FOOTER KNOPPEN */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
          {formData.id ? (
            <button
              onClick={handleDelete}
              disabled={loading}
              style={{
                background: '#d32f2f',
                color: '#fff',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Verwijderen
            </button>
          ) : (
            <div />
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onClose} style={{ padding: '6px 12px', cursor: 'pointer' }}>
              Annuleren
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !formData.sourceId || !formData.targetId || !formData.relationId}
              style={{
                background: '#007acc',
                color: '#fff',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                opacity: loading || !formData.sourceId || !formData.targetId || !formData.relationId ? 0.6 : 1,
              }}
            >
              {loading ? 'Opslaan...' : 'Opslaan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};