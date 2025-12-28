
import React, { useState, useEffect, useRef } from 'react';

// --- Types ---

type BlockType = 'header' | 'paragraph' | 'list' | 'table' | 'separator';

interface BaseBlock {
  id: string;
  type: BlockType;
}

interface HeaderBlock extends BaseBlock {
  type: 'header';
  level: number;
  text: string;
}

interface ParagraphBlock extends BaseBlock {
  type: 'paragraph';
  text: string;
}

interface ListBlock extends BaseBlock {
  type: 'list';
  items: string[];
}

interface TableBlock extends BaseBlock {
  type: 'table';
  headers: string[];
  rows: string[][];
}

interface SeparatorBlock extends BaseBlock {
  type: 'separator';
}

type Block = HeaderBlock | ParagraphBlock | ListBlock | TableBlock | SeparatorBlock;

interface EditableAuditMemoProps {
  initialContent: string;
  onUpdate: (newContent: string) => void;
}

// --- Helper Functions ---

const generateId = () => Math.random().toString(36).substr(2, 9);

const parseMarkdown = (md: string): Block[] => {
  const lines = md.split('\n');
  const blocks: Block[] = [];
  let currentTable: TableBlock | null = null;
  let currentList: ListBlock | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Table Logic
    if (line.startsWith('|')) {
      const row = line.split('|').slice(1, -1).map(c => c.trim());
      if (currentTable) {
        // Check if it's a separator row
        if (line.includes('---')) {
            // Skip separator row in data
        } else {
            currentTable.rows.push(row);
        }
      } else {
        // Start new table (assume first row is header)
        currentTable = {
          id: generateId(),
          type: 'table',
          headers: row,
          rows: []
        };
        blocks.push(currentTable);
      }
      continue;
    } else if (currentTable) {
      currentTable = null;
    }

    // Header Logic
    if (line.startsWith('#')) {
      const match = line.match(/^(#+)\s+(.*)/);
      if (match) {
        blocks.push({
          id: generateId(),
          type: 'header',
          level: match[1].length,
          text: match[2]
        });
        continue;
      }
    }

    // Separator Logic
    if (line === '---' || line === '***') {
      blocks.push({ id: generateId(), type: 'separator' });
      continue;
    }

    // List Logic
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const text = line.substring(2);
      if (currentList) {
        currentList.items.push(text);
      } else {
        currentList = {
          id: generateId(),
          type: 'list',
          items: [text]
        };
        blocks.push(currentList);
      }
      continue;
    } else if (currentList && line.trim() !== '') {
        currentList = null;
    } else {
        currentList = null;
    }

    // Paragraph Logic
    if (line.length > 0) {
      blocks.push({
        id: generateId(),
        type: 'paragraph',
        text: line
      });
    }
  }
  return blocks;
};

const serializeMarkdown = (blocks: Block[]): string => {
  return blocks.map(block => {
    switch (block.type) {
      case 'header':
        return `${'#'.repeat(block.level)} ${block.text}`;
      case 'paragraph':
        return block.text;
      case 'separator':
        return '---';
      case 'list':
        return block.items.map(item => `- ${item}`).join('\n');
      case 'table':
        const colCount = block.headers.length;
        const headerRow = `| ${block.headers.join(' | ')} |`;
        const sepRow = `| ${block.headers.map(() => '---').join(' | ')} |`;
        const bodyRows = block.rows.map(row => {
            const paddedRow = [...row];
            while(paddedRow.length < colCount) paddedRow.push('');
            return `| ${paddedRow.join(' | ')} |`;
        }).join('\n');
        return `${headerRow}\n${sepRow}\n${bodyRows}`;
      default:
        return '';
    }
  }).join('\n\n');
};

const isColumnEditable = (headers: string[], colIndex: number): boolean => {
  const headerName = headers[colIndex]?.toLowerCase() || '';
  const allHeaders = headers.map(h => h.toLowerCase());

  // Case 1: Overview or Population/Sample Tables (Headers: Section, Content)
  if (allHeaders.includes('section') && allHeaders.includes('content')) {
    // Only "Content" is editable
    return headerName === 'content';
  }

  // Case 2: Test Sheet (Headers typically: Test Attribute, Description, Tickmark, Notes, Reference)
  // We identify this table if it has specific columns
  if (allHeaders.some(h => h.includes('test attribute') || h.includes('tickmark'))) {
    // Only Tickmark, Testing Notes, and Reference are editable
    return headerName.includes('tickmark') || headerName.includes('note') || headerName.includes('reference');
  }

  // Default: If structure is unknown, allow editing to prevent blocking valid edits on unexpected tables
  return true;
};

const renderStyledText = (text: string) => {
  // Split by bold markers: **text**
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return <strong key={index} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

const getColumnClass = (header: string): string => {
  const h = header.toLowerCase();
  const base = "px-4 py-3 border-b border-brand-100 align-top";
  
  // Specific logic for Test Sheet to prioritize Notes
  if (h.includes('testing notes') || h.includes('notes')) {
    return `${base} w-[35%] min-w-[300px]`; // Largest column
  }
  if (h.includes('reference')) {
    return `${base} w-[15%] min-w-[120px]`;
  }
  if (h.includes('tickmark')) {
    return `${base} w-[10%] min-w-[100px] whitespace-nowrap`;
  }
  if (h.includes('description') && (h.includes('attribute') || h.includes('test'))) {
     return `${base} w-[20%] min-w-[180px]`;
  }
  if (h.includes('attribute')) {
     return `${base} w-[20%] min-w-[150px]`;
  }

  // Specific logic for Overview/Population Tables
  if (h === 'section') {
    return `${base} w-[30%] min-w-[180px]`;
  }
  if (h === 'content') {
    return `${base} w-[70%]`;
  }

  // Default fallback
  return `${base} min-w-[150px]`;
};

// --- Component ---

export const EditableAuditMemo: React.FC<EditableAuditMemoProps> = ({ initialContent, onUpdate }) => {
  // Initialize state directly from prop. Since the parent uses a unique key (timestamp) for each new generation,
  // this component remounts and re-initializes when a new memo is generated.
  const [blocks, setBlocks] = useState<Block[]>(() => parseMarkdown(initialContent));
  
  // History state for Undo
  const [history, setHistory] = useState<Block[][]>(() => [parseMarkdown(initialContent)]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const handleUpdate = (newBlocks: Block[]) => {
    setBlocks(newBlocks);
    
    // Add to history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newBlocks);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);

    const markdown = serializeMarkdown(newBlocks);
    onUpdate(markdown);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const prevBlocks = history[newIndex];
      setBlocks(prevBlocks);
      setHistoryIndex(newIndex);
      // Update parent but do not push to history stack again
      onUpdate(serializeMarkdown(prevBlocks));
    }
  };

  // Keyboard listener for Undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history]); 

  const updateBlockText = (id: string, newText: string) => {
    const newBlocks = blocks.map(b => 
      b.id === id && (b.type === 'paragraph') 
        ? { ...b, text: newText } 
        : b
    );
    handleUpdate(newBlocks as Block[]);
  };

  const updateList = (id: string, newText: string) => {
    const items = newText.split('\n').map(line => line.replace(/^- /, '').trim());
    const newBlocks = blocks.map(b => 
        b.id === id && b.type === 'list' ? { ...b, items } : b
    );
    handleUpdate(newBlocks as Block[]);
  };

  const updateTableCell = (blockId: string, rowIndex: number, colIndex: number, val: string) => {
    const newBlocks = blocks.map(b => {
      if (b.id !== blockId || b.type !== 'table') return b;
      
      const newTable = { ...b };
      const newRows = [...newTable.rows];
      const newRow = [...newRows[rowIndex]];
      newRow[colIndex] = val;
      newRows[rowIndex] = newRow;
      newTable.rows = newRows;
      
      return newTable;
    });
    handleUpdate(newBlocks as Block[]);
  };

  return (
    <div className="space-y-6 pb-12">
      {blocks.map((block) => {
        switch (block.type) {
          case 'header':
            return (
              <div
                key={block.id}
                className={`w-full px-2 py-1 text-slate-900 font-bold ${
                    block.level === 1 ? 'text-2xl mt-6 mb-4' : 
                    block.level === 2 ? 'text-xl mt-6 mb-3 text-brand-800' : 
                    'text-lg mt-4 mb-2'
                }`}
              >
                {block.text}
              </div>
            );
          
          case 'paragraph':
            return (
              <div key={block.id} className="relative group">
                <AutoResizeTextarea
                    className="w-full bg-slate-50/50 border border-slate-200 hover:border-brand-300 focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500 rounded-md px-3 py-2 text-slate-700 leading-relaxed transition-all"
                    value={block.text}
                    onChange={(val) => updateBlockText(block.id, val)}
                />
              </div>
            );

            case 'list':
                return (
                    <div key={block.id} className="pl-4">
                        <AutoResizeTextarea
                            className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-brand-500 focus:bg-white rounded px-2 py-1 text-slate-700 font-medium"
                            value={block.items.map(i => `- ${i}`).join('\n')}
                            onChange={(val) => updateList(block.id, val)}
                        />
                    </div>
                )

          case 'table':
            return (
              <div key={block.id} className="overflow-x-auto my-6 rounded-lg border border-slate-200 shadow-sm bg-white">
                <table className="w-full text-sm text-left">
                  <thead className="bg-brand-50 text-brand-900 uppercase font-semibold">
                    <tr>
                      {block.headers.map((header, idx) => (
                        <th key={idx} className={getColumnClass(header)}>
                            {renderStyledText(header)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {block.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50">
                        {row.map((cell, cIdx) => {
                            const isEditable = isColumnEditable(block.headers, cIdx);
                            const headerName = block.headers[cIdx]?.toLowerCase() || '';
                            
                            // Determine if this cell should be a dropdown for Conclusion Summary
                            const isConclusionRow = row[0]?.toLowerCase().includes('conclusion summary');
                            const isContentCol = headerName === 'content';
                            const isConclusionDropdown = isConclusionRow && isContentCol;
                            
                            // Determine if this cell should be a dropdown for Tickmark
                            const isTickmarkDropdown = headerName.includes('tickmark');

                            return (
                              <td key={cIdx} className={`p-1 align-top ${!isEditable ? 'bg-slate-50/50' : ''}`}>
                                {isEditable ? (
                                    isConclusionDropdown ? (
                                        <select
                                            className="w-full bg-transparent px-3 py-2 border border-transparent hover:bg-white hover:border-slate-300 focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500 rounded-md transition-all text-slate-700 cursor-pointer"
                                            value={cell}
                                            onChange={(e) => updateTableCell(block.id, rIdx, cIdx, e.target.value)}
                                        >
                                            <option value="Effective">Effective</option>
                                            <option value="Ineffective">Ineffective</option>
                                            <option value="Insufficient Evidence">Insufficient Evidence</option>
                                        </select>
                                    ) : isTickmarkDropdown ? (
                                         <select
                                            className="w-full bg-transparent px-3 py-2 border border-transparent hover:bg-white hover:border-slate-300 focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500 rounded-md transition-all text-slate-700 cursor-pointer"
                                            // Clean value to match options (strip bold markdown if present)
                                            value={cell.replace(/\*\*/g, '').trim()}
                                            onChange={(e) => updateTableCell(block.id, rIdx, cIdx, e.target.value)}
                                        >
                                            {!['Pass', 'Fail', 'N/A'].includes(cell.replace(/\*\*/g, '').trim()) && cell.trim() !== '' && (
                                              <option value={cell.replace(/\*\*/g, '').trim()}>{cell.replace(/\*\*/g, '').trim()}</option>
                                            )}
                                            <option value="Pass">Pass</option>
                                            <option value="Fail">Fail</option>
                                            <option value="N/A">N/A</option>
                                        </select>
                                    ) : (
                                        <AutoResizeTextarea 
                                            className="w-full bg-transparent px-3 py-2 border border-transparent hover:bg-white hover:border-slate-300 focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500 rounded-md transition-all text-slate-700"
                                            value={cell}
                                            onChange={(val) => updateTableCell(block.id, rIdx, cIdx, val)}
                                        />
                                    )
                                ) : (
                                    <div className="px-3 py-2 text-slate-600 whitespace-pre-wrap break-words">
                                        {renderStyledText(cell)}
                                    </div>
                                )}
                              </td>
                            );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
            
            case 'separator':
                return <hr key={block.id} className="my-6 border-slate-200" />;

          default:
            return null;
        }
      })}
    </div>
  );
};

// Helper for auto-resizing textarea
const AutoResizeTextarea: React.FC<{
  value: string;
  onChange: (val: string) => void;
  className?: string;
}> = ({ value, onChange, className }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      rows={1}
      className={`${className} resize-none overflow-hidden block`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
};
