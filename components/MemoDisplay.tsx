
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
    
    // Extreme width for high-fidelity landscape capture to prevent any clipping of wide IA test sheets
    const exportWidth = 2200; 
    
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
        .pdf-capture-root { 
          width: ${exportWidth}px !important; 
          padding: 80px !important; 
          background: white !important; 
          font-family: 'Inter', sans-serif !important;
          color: #000 !important;
        }
        * { 
          overflow: visible !important; 
          max-width: none !important; 
          max-height: none !important; 
          height: auto !important;
          box-sizing: border-box !important;
        }
        table { 
          width: 100% !important; 
          table-layout: auto !important; 
          border-collapse: collapse !important; 
          border: 1px solid #000 !important;
          margin: 30px 0 !important;
        }
        th, td { 
          border: 1px solid #000 !important; 
          padding: 15px !important; 
          font-size: 15px !important;
          vertical-align: top !important;
          word-break: break-word !important;
          line-height: 1.5 !important;
        }
        th { font-weight: bold !important; background-color: #f1f5f9 !important; }
        h1, h2, h3 { color: #000 !important; margin-top: 40px !important; }
        h2 { border-bottom: 2px solid #0d9488 !important; padding-bottom: 10px !important; }
        textarea, select, input, button { display: none !important; }
      `;
      tempContainer.appendChild(styleOverride);
      element.classList.add('pdf-capture-root');

      // Convert dynamic inputs to static text in the clone
      element.querySelectorAll('textarea').forEach(ta => {
        const div = document.createElement('div');
        div.innerText = ta.value;
        div.style.whiteSpace = 'pre-wrap';
        div.style.padding = '8px 0';
        ta.parentNode?.replaceChild(div, ta);
      });

      element.querySelectorAll('select').forEach(sel => {
        const span = document.createElement('span');
        span.innerText = sel.value;
        span.style.fontWeight = 'bold';
        span.style.padding = '2px 8px';
        span.style.backgroundColor = '#f1f5f9';
        span.style.borderRadius = '4px';
        sel.parentNode?.replaceChild(span, sel);
      });

      const pdfHeader = document.createElement('div');
      pdfHeader.innerHTML = `
        <div style="margin-bottom: 60px; border-bottom: 10px solid #0d9488; padding-bottom: 40px;">
          <h1 style="margin: 0; font-size: 48px; font-weight: 900; color: #134e4a; letter-spacing: -0.05em;">INTERNAL AUDIT WORKPAPER</h1>
          <div style="margin-top: 25px; display: flex; justify-content: space-between; font-size: 20px; color: #334155;">
            <span><strong>Workpaper Date:</strong> ${new Date(result.timestamp).toLocaleDateString()}</span>
            <div style="text-align: right;">
                <div style="background: #134e4a; color: white; padding: 5px 15px; border-radius: 6px; font-size: 14px; font-weight: bold; margin-bottom: 10px; display: inline-block;">STRICTLY CONFIDENTIAL</div>
                <br/>
                <span><strong>Status:</strong> FINAL TESTING REPORT</span>
            </div>
          </div>
        </div>
      `;
      element.prepend(pdfHeader);
      tempContainer.appendChild(element);

      const opt = {
        margin: 10,
        filename: `Internal_Audit_Report_${new Date().toISOString().slice(0,10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          windowWidth: exportWidth, 
          logging: false,
          letterRendering: true
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
        pagebreak: { mode: 'css' }
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
                Internal Audit Memo
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
