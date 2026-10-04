import React, { useState } from 'react';
// Importeer rechtstreeks uit de gegenererde Wails bindings van App
// 1. Importeer de juiste, generieke Go-methode
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

  // Hulpmethode om uit een INSERT...SELECT query puur het SELECT-deel te isoleren voor de Preview
  const preparePreviewQuery = (rawSql: string): string => {
    let cleanSql = rawSql;

    // Als er een INSERT INTO in staat, pakken we alles vanaf de eerste SELECT
    const selectIndex = cleanSql.search(/\bSELECT\b/i);
    if (selectIndex !== -1) {
      cleanSql = cleanSql.substring(selectIndex);
    }

    // Vervang placeholders tijdelijk voor de preview
    cleanSql = cleanSql.replace(/\{uuidv7\}/gi, "NULL");
    cleanSql = cleanSql.replace(/\{now\}/gi, "CURRENT_TIMESTAMP");

    return cleanSql;
  };

  const handlePreview = async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setStatusMessage(null);
    try {
      // Schoon de query op voor de preview
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
      // 2. Roep de generieke Go-functie aan met de originele SQL-query (inclusief {uuidv7} en {now})
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
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h2>KESY Toolbox</h2>

      {/* Tab Navigatie */}
      <div style={{ display: 'flex', borderBottom: '1px solid #ccc', marginBottom: '16px' }}>
        <button
          onClick={() => setActiveTab('sql-generator')}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'sql-generator' ? '2px solid #007acc' : 'none',
            fontWeight: activeTab === 'sql-generator' ? 'bold' : 'normal',
            cursor: 'pointer',
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
            borderBottom: activeTab === 'batch-tools' ? '2px solid #007acc' : 'none',
            fontWeight: activeTab === 'batch-tools' ? 'bold' : 'normal',
            cursor: 'pointer',
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
                style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}
                title="Voegt {uuidv7} token in (wordt per record gegenereerd door Go)"
              >
                + Token &#123;uuidv7&#125;
              </button>
              <button 
                onClick={() => handleInsertPlaceholder('{now}')} 
                style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}
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
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handlePreview} disabled={isLoading || !query.trim()}>
              {isLoading ? 'Bezig...' : '1. Controleer & Tel Records'}
            </button>

            {preview && preview.count > 0 && !preview.error && (
              <button 
                onClick={handleExecute} 
                disabled={isLoading}
                style={{ background: '#007bff', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
              >
                2. Voer uit ({preview.count} records)
              </button>
            )}
          </div>

          {preview && !preview.error && (
            <div style={{ background: '#f8f9fa', padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }}>
              <strong>Resultaat preview:</strong> {preview.count} record(s) gevonden om in te voegen.
              {preview.columns.length > 0 && (
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  Kolommen in SELECT: {preview.columns.join(', ')}
                </div>
              )}
            </div>
          )}

          {statusMessage && (
            <div style={{
              padding: '10px',
              borderRadius: '4px',
              background: statusMessage.isError ? '#f8d7da' : '#d4edda',
              color: statusMessage.isError ? '#721c24' : '#155724'
            }}>
              {statusMessage.text}
            </div>
          )}
        </div>
      )}

      {activeTab === 'batch-tools' && (
        <div>
          <p style={{ color: '#666' }}>Ruimte voor toekomstige losse hulpprogramma's.</p>
        </div>
      )}
    </div>
  );
};