import React, { useState } from 'react';
import { 
  PreviewSQLQuery, 
  ExecuteGenericInsertWithUUIDv7
} from '../../../wailsjs/go/main/App';

type ToolboxTab = 'sql-generator' | 'batch-tools';

export const ToolboxModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ToolboxTab>('sql-generator');

  // SQL State
  const [query, setQuery] = useState<string>('');
  const [preview, setPreview] = useState<{ count: number; columns: string[]; error?: string } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const preparePreviewQuery = (rawSql: string): string => {
    let cleanSql = rawSql;

    const selectIndex = cleanSql.search(/\bSELECT\b/i);
    if (selectIndex !== -1) {
      cleanSql = cleanSql.substring(selectIndex);
    }

    cleanSql = cleanSql.replace(/\{uuidv7\}/gi, "NULL");
    cleanSql = cleanSql.replace(/\{now\}/gi, "CURRENT_TIMESTAMP");

    return cleanSql;
  };

  const handlePreview = async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const previewSql = preparePreviewQuery(query);
      const res = await PreviewSQLQuery({ query: previewSql });
      
      setPreview(res);
      if (res.error) {
        setStatusMessage({ text: `Preview fout: ${res.error}`, isError: true });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Fout bij uitvoeren preview: ${err}`, isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInsertPlaceholder = (token: string) => {
    setQuery((prev) => prev + ` ${token} `);
  };

  const handleExecute = async () => {
    if (!preview || preview.count === 0) return;

    if (!window.confirm(`Weet u zeker dat u deze actie wilt uitvoeren voor ${preview.count} records?`)) {
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);
    try {
      const res = await ExecuteGenericInsertWithUUIDv7(query);
      
      if (res.success) {
        setStatusMessage({ text: res.message, isError: false });
        setPreview(null);
      } else {
        setStatusMessage({ text: res.message, isError: true });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Uitvoeringsfout: ${err}`, isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', color: 'var(--text-color, inherit)' }}>
      <h2>KESY Toolbox</h2>

      {/* Tab Navigatie - Geoptimaliseerd voor Dark & Light Mode */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color, #444)', marginBottom: '16px' }}>
        <button
          onClick={() => setActiveTab('sql-generator')}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: 'none',
            color: activeTab === 'sql-generator' ? '#3182ce' : 'var(--tab-text-color, #a0aec0)',
            borderBottom: activeTab === 'sql-generator' ? '2px solid #3182ce' : '2px solid transparent',
            fontWeight: activeTab === 'sql-generator' ? 'bold' : 'normal',
            cursor: 'pointer',
            transition: 'color 0.2s, border-color 0.2s'
          }}
        >
          SQL Record Generator
        </button>
        <button
          onClick={() => setActiveTab('batch-tools')}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: 'none',
            color: activeTab === 'batch-tools' ? '#3182ce' : 'var(--tab-text-color, #a0aec0)',
            borderBottom: activeTab === 'batch-tools' ? '2px solid #3182ce' : '2px solid transparent',
            fontWeight: activeTab === 'batch-tools' ? 'bold' : 'normal',
            cursor: 'pointer',
            transition: 'color 0.2s, border-color 0.2s'
          }}
        >
          Overige Utilities
        </button>
      </div>

      {/* Tab Inhoud */}
      {activeTab === 'sql-generator' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontWeight: 'bold' }}>Voer SQL-query in:</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => handleInsertPlaceholder('{uuidv7}')} 
                style={{ 
                  padding: '4px 10px', 
                  fontSize: '12px', 
                  cursor: 'pointer',
                  backgroundColor: 'var(--btn-bg, #2d3748)',
                  color: 'var(--btn-text, #e2e8f0)',
                  border: '1px solid var(--border-color, #4a5568)',
                  borderRadius: '4px'
                }}
                title="Voegt {uuidv7} token in (wordt per record gegenereerd door Go)"
              >
                + Token &#123;uuidv7&#125;
              </button>
              <button 
                onClick={() => handleInsertPlaceholder('{now}')} 
                style={{ 
                  padding: '4px 10px', 
                  fontSize: '12px', 
                  cursor: 'pointer',
                  backgroundColor: 'var(--btn-bg, #2d3748)',
                  color: 'var(--btn-text, #e2e8f0)',
                  border: '1px solid var(--border-color, #4a5568)',
                  borderRadius: '4px'
                }}
                title="Voegt {now} token in (wordt vervangen door ISO-8601 UTC datum/tijd)"
              >
                + Token &#123;now&#125;
              </button>
            </div>
          </div>

          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={12}
            placeholder="INSERT INTO relation_values (...) SELECT {uuidv7}, o.id, ..., {now} FROM objects o ..."
            style={{
              width: '100%',
              fontFamily: 'monospace',
              padding: '10px',
              backgroundColor: 'var(--input-bg, #1a202c)',
              color: 'var(--input-text, #edf2f7)',
              border: '1px solid var(--border-color, #4a5568)',
              borderRadius: '4px',
              resize: 'vertical'
            }}
          />

          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={handlePreview} 
              disabled={isLoading || !query.trim()}
              style={{
                padding: '8px 16px',
                backgroundColor: isLoading || !query.trim() ? '#4a5568' : '#2b6cb0',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                cursor: isLoading || !query.trim() ? 'not-allowed' : 'pointer'
              }}
            >
              {isLoading ? 'Bezig...' : '1. Controleer & Tel Records'}
            </button>

            {preview && preview.count > 0 && !preview.error && (
              <button 
                onClick={handleExecute} 
                disabled={isLoading}
                style={{ 
                  backgroundColor: '#276749', 
                  color: '#ffffff', 
                  border: 'none', 
                  padding: '8px 16px', 
                  borderRadius: '4px', 
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                2. Voer uit ({preview.count} records)
              </button>
            )}
          </div>

          {preview && !preview.error && (
            <div style={{ 
              backgroundColor: 'var(--card-bg, #2d3748)', 
              color: 'var(--card-text, #e2e8f0)',
              padding: '12px', 
              border: '1px solid var(--border-color, #4a5568)', 
              borderRadius: '4px' 
            }}>
              <strong>Resultaat preview:</strong> {preview.count} record(s) gevonden om in te voegen.
              {preview.columns.length > 0 && (
                <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>
                  Kolommen in SELECT: {preview.columns.join(', ')}
                </div>
              )}
            </div>
          )}

          {statusMessage && (
            <div style={{
              padding: '10px',
              borderRadius: '4px',
              backgroundColor: statusMessage.isError ? '#742a2a' : '#22543d',
              color: statusMessage.isError ? '#fed7d7' : '#c6f6d5',
              border: `1px solid ${statusMessage.isError ? '#9b2c2c' : '#2f855a'}`
            }}>
              {statusMessage.text}
            </div>
          )}
        </div>
      )}

      {activeTab === 'batch-tools' && (
        <div>
          <p style={{ opacity: 0.7 }}>Ruimte voor toekomstige losse hulpprogramma's.</p>
        </div>
      )}
    </div>
  );
};