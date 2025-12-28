
import React, { useState, useRef } from 'react';
import { GenerationResult } from '../types';
import { EditableAuditMemo } from './MarkdownRenderer';
import { Copy, CheckCircle, FileCheck, Wand2, Maximize2, PanelLeftOpen, FileDown } from 'lucide-react';
// @ts-ignore
import html2pdf from 'html2pdf.js';

interface MemoDisplayProps {
  result: GenerationResult | null;
  onUpdate: (newMemo: string) => void;
  onRefine: (instructions: string) => Promise<void>;
  isRefining: boolean;
  showInputs: boolean;
  onToggleInputs: () => void;
}

export const MemoDisplay: React.FC<MemoDisplayProps> = ({ 
  result, 
  onUpdate, 
  onRefine, 
  isRefining,
  showInputs,
  onToggleInputs
}) => {
  const [refineInput, setRefineInput] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const memoRef = useRef<HTMLDivElement>(null);

  if (!result) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 p-12 bg-white rounded-xl border border-slate-200 border-dashed">
        <div className="bg-slate-50 p-4 rounded-full mb-4">
          <FileCheck size={48} className="text-slate-300" />
        </div>
        <h3 className="text-lg font-medium text-slate-600 mb-2">No Audit Memo Generated</h3>
        <p className="text-center text-sm max-w-xs">
          Fill out the control details and upload evidence on the left to generate your SOX testing documentation.
        </p>
      </div>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(result.memo);
    alert('Memo copied to clipboard!');
  };

  const handleExportPDF = async () => {
    if (!memoRef.current) return;
    setIsExporting(true);
    
    // Use 1200px as a virtual width to allow more horizontal breathing room for audit tables, 
    // which then scales down to the A4 page.
    const exportWidth = 1000; 
    
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '0';
    tempContainer.style.width = `${exportWidth}px`; 
    tempContainer.style.backgroundColor = '#ffffff';
    document.body.appendChild(tempContainer);

    try {
      let h2p: any = (html2pdf as any).default || html2pdf;
      if (typeof (window as any).html2pdf === 'function') h2p = (window as any).html2pdf;

      const element = memoRef.current.cloneNode(true) as HTMLElement;
      
      const styleOverride = document.createElement('style');
      styleOverride.innerHTML = `
        .pdf-export-body { 
          width: ${exportWidth}px !important; 
          padding: 40px !important; 
          background: white !important; 
          color: #000 !important;
          font-family: 'Segoe UI', Arial, sans-serif !important;
          margin: 0 !important;
        }
        /* Reset and Force wrap */
        * { 
          max-width: 100% !important; 
          box-sizing: border-box !important;
          overflow: visible !important;
          word-wrap: break-word !important;
          overflow-wrap: anywhere !important;
        }
        h1, h2, h3 { 
          page-break-after: avoid !important; 
          color: #134e4a !important;
          margin-top: 20pt !important;
          font-weight: bold !important;
        }
        h1 { font-size: 24pt !important; margin-top: 0 !important; }
        h2 { border-bottom: 2pt solid #0d9488 !important; padding-bottom: 5pt !important; font-size: 16pt !important; margin-bottom: 10pt !important; }
        
        table { 
          width: 100% !important; 
          table-layout: fixed !important; /* CRITICAL: Force fixed layout */
          border-collapse: collapse !important; 
          margin: 15pt 0 !important;
          border: 1pt solid #000 !important;
        }
        thead { display: table-header-group !important; } /* Repeat headers */
        tr { page-break-inside: avoid !important; }
        th, td { 
          border: 1pt solid #000 !important; 
          padding: 6pt !important; 
          font-size: 9pt !important; /* Smaller text for audit workpapers */
          vertical-align: top !important;
          line-height: 1.4 !important;
        }
        th { background-color: #f8fafc !important; font-weight: bold !important; text-align: left !important; }
        
        /* Column distribution for 2-column tables (Overview/Population) */
        table:not(.test-sheet) tr th:nth-child(1), table:not(.test-sheet) tr td:nth-child(1) { width: 30% !important; font-weight: bold !important; }
        table:not(.test-sheet) tr th:nth-child(2), table:not(.test-sheet) tr td:nth-child(2) { width: 70% !important; }

        /* Column distribution for 5-column Test Sheet (Alphabetical attributes) */
        table.test-sheet tr th:nth-child(1), table.test-sheet tr td:nth-child(1) { width: 5% !important; text-align: center !important; } /* Ref (A, B...) */
        table.test-sheet tr th:nth-child(2), table.test-sheet tr td:nth-child(2) { width: 25% !important; } /* Description */
        table.test-sheet tr th:nth-child(3), table.test-sheet tr td:nth-child(3) { width: 10% !important; text-align: center !important; } /* Tickmark */
        table.test-sheet tr th:nth-child(4), table.test-sheet tr td:nth-child(4) { width: 45% !important; } /* Notes (Primary) */
        table.test-sheet tr th:nth-child(5), table.test-sheet tr td:nth-child(5) { width: 15% !important; } /* Reference */

        /* Remove UI-specific elements */
        .no-export, button, .lucide { display: none !important; }
      `;
      tempContainer.appendChild(styleOverride);
      element.classList.add('pdf-export-body');

      // Tag the test sheet table for specific widths
      element.querySelectorAll('table').forEach(tbl => {
        if (tbl.rows[0]?.cells.length >= 5) {
          tbl.classList.add('test-sheet');
        }
      });

      // Static UI Replacements
      element.querySelectorAll('textarea').forEach(ta => {
        const div = document.createElement('div');
        div.innerText = ta.value;
        div.style.whiteSpace = 'pre-wrap';
        ta.parentNode?.replaceChild(div, ta);
      });
      element.querySelectorAll('select').forEach(sel => {
        const span = document.createElement('span');
        span.innerText = sel.value;
        span.style.fontWeight = 'bold';
        sel.parentNode?.replaceChild(span, sel);
      });

      const pdfHeader = document.createElement('div');
      pdfHeader.innerHTML = `
        <div style="margin-bottom: 30pt; border-bottom: 5pt solid #0d9488; padding-bottom: 10pt; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h1 style="margin: 0; font-size: 28pt; color: #134e4a; font-weight: 900;">INTERNAL AUDIT</h1>
            <span style="font-size: 10pt; color: #666; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Control Testing Workpaper</span>
          </div>
          <div style="text-align: right; font-size: 9pt; color: #334155;">
             <div><strong>Ref:</strong> ${result.memo.split('\n')[0].replace('#', '').trim().substring(0, 15)}</div>
             <div><strong>Date:</strong> ${new Date(result.timestamp).toLocaleDateString()}</div>
             <div style="color: #0d9488; font-weight: bold; margin-top: 4pt;">STRICTLY CONFIDENTIAL</div>
          </div>
        </div>
      `;
      element.prepend(pdfHeader);

      tempContainer.appendChild(element);

      const opt = {
        margin: [10, 10, 10, 10], // Slim margins to maximize content space
        filename: `SOX_Workpaper_${new Date().toISOString().slice(0,10)}.pdf`,
        image: { type: 'jpeg', quality: 1.0 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          windowWidth: exportWidth,
          logging: false 
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      await h2p().set(opt).from(element).save();
      
    } catch (error: any) {
      console.error("PDF Export failed:", error);
      alert(`Export failed: ${error.message}`);
    } finally {
      if (document.body.contains(tempContainer)) document.body.removeChild(tempContainer);
      setIsExporting(false);
    }
  };

  const handleRefineSubmit = async () => {
    if (!refineInput.trim()) return;
    await onRefine(refineInput);
    setRefineInput('');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
      <div className="bg-brand-50 border-b border-brand-100 px-6 py-4 flex justify-between items-center flex-wrap gap-3">
        <div>
            <h2 className="text-brand-900 font-bold text-lg flex items-center gap-2">
                <CheckCircle size={20} className="text-brand-600" />
                Audit Documentation
            </h2>
            <p className="text-xs text-brand-700 mt-1">{`Created: ${new Date(result.timestamp).toLocaleString()}`}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleInputs}
            className="flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-900 bg-white/50 hover:bg-white px-3 py-1.5 rounded-md transition border border-brand-200"
          >
             {showInputs ? <Maximize2 size={16} /> : <PanelLeftOpen size={16} />}
             <span className="hidden sm:inline">{showInputs ? "Expand" : "Show Inputs"}</span>
          </button>
          
          <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-900 bg-white/50 hover:bg-white px-3 py-1.5 rounded-md transition border border-brand-200 disabled:opacity-50"
          >
              {isExporting ? <span className="animate-spin h-4 w-4 border-2 border-brand-600 border-t-transparent rounded-full"></span> : <FileDown size={16} />}
              Export PDF
          </button>

          <button onClick={handleCopy} className="flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-900 bg-white/50 hover:bg-white px-3 py-1.5 rounded-md transition border border-brand-200">
              <Copy size={16} />
              Copy
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-8 bg-white" ref={memoRef}>
        <EditableAuditMemo key={result.timestamp} initialContent={result.memo} onUpdate={onUpdate} />
      </div>
      
      <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
        <div className="flex flex-col space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">IA Refinement Instructions</label>
            <div className="flex gap-2">
                <input 
                    type="text" 
                    className="flex-1 px-4 py-2 text-sm bg-white text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-slate-400"
                    placeholder="e.g., 'Update IA notes for attribute B to reflect Q3 evidence'"
                    value={refineInput}
                    onChange={(e) => setRefineInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !isRefining && handleRefineSubmit()}
                    disabled={isRefining}
                />
                <button 
                    onClick={handleRefineSubmit}
                    disabled={isRefining || !refineInput.trim()}
                    className={`px-4 py-2 rounded-lg text-white text-sm font-medium flex items-center gap-2 transition ${isRefining || !refineInput.trim() ? 'bg-brand-300 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700'}`}
                >
                    {isRefining ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span> : <Wand2 size={16} />}
                    Refine
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
