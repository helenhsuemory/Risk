
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
    
    // Create a temporary container to render the full content for export
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '0';
    tempContainer.style.width = '1200px'; // Wide enough for the Test Sheet table
    tempContainer.style.backgroundColor = '#ffffff';
    document.body.appendChild(tempContainer);

    try {
      // Find the library function defensively
      let h2p: any = null;
      if (typeof html2pdf === 'function') {
        h2p = html2pdf;
      } else if (html2pdf && typeof html2pdf.default === 'function') {
        h2p = html2pdf.default;
      } else if (typeof (window as any).html2pdf === 'function') {
        h2p = (window as any).html2pdf;
      }

      if (!h2p) {
        throw new Error("PDF library (html2pdf) could not be properly initialized. Try refreshing the page.");
      }

      // Clone the content for PDF
      const element = memoRef.current.cloneNode(true) as HTMLElement;
      
      // CRITICAL: Neutralize all constraints that cause cutting
      element.style.height = 'auto';
      element.style.maxHeight = 'none';
      element.style.overflow = 'visible';
      element.style.width = '1200px'; 
      element.style.padding = '40px';
      
      // Deep strip all overflow classes and fixed heights from children
      const children = element.querySelectorAll('*');
      children.forEach((child: any) => {
        const style = window.getComputedStyle(child);
        if (style.overflowX === 'auto' || style.overflowX === 'scroll' || style.overflow === 'auto') {
          child.style.overflow = 'visible';
          child.style.overflowX = 'visible';
          child.style.width = 'auto';
          child.style.maxWidth = 'none';
        }
        if (style.height !== 'auto' || style.maxHeight !== 'none') {
          child.style.height = 'auto';
          child.style.maxHeight = 'none';
        }
      });

      // Static replacement for inputs
      const textareas = Array.from(element.querySelectorAll('textarea'));
      textareas.forEach(ta => {
        const replacement = document.createElement('div');
        replacement.textContent = ta.value;
        replacement.style.whiteSpace = 'pre-wrap';
        replacement.style.color = '#1e293b';
        replacement.style.lineHeight = '1.6';
        replacement.style.padding = '8px 0';
        replacement.style.fontSize = '14px';
        ta.parentNode?.replaceChild(replacement, ta);
      });

      const selects = Array.from(element.querySelectorAll('select'));
      selects.forEach(sel => {
        const replacement = document.createElement('span');
        replacement.textContent = sel.value;
        replacement.style.fontWeight = '600';
        replacement.style.padding = '4px 10px';
        replacement.style.borderRadius = '4px';
        replacement.style.fontSize = '13px';
        replacement.style.display = 'inline-block';
        
        const val = sel.value.toLowerCase();
        if (val === 'pass' || val === 'effective') {
          replacement.style.color = '#15803d';
          replacement.style.backgroundColor = '#f0fdf4';
        } else if (val === 'fail' || val === 'ineffective') {
          replacement.style.color = '#b91c1c';
          replacement.style.backgroundColor = '#fef2f2';
        } else {
          replacement.style.color = '#334155';
          replacement.style.backgroundColor = '#f8fafc';
        }
        sel.parentNode?.replaceChild(replacement, sel);
      });

      // Add a professional header
      const pdfHeader = document.createElement('div');
      pdfHeader.innerHTML = `
        <div style="margin-bottom: 30px; border-bottom: 3px solid #0d9488; padding-bottom: 15px; font-family: 'Inter', sans-serif;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h1 style="color: #134e4a; margin: 0; font-size: 26px; font-weight: bold;">SOX Compliance Testing Memo</h1>
            <div style="text-align: right; color: #64748b; font-size: 11px;">
              CONFIDENTIAL - INTERNAL AUDIT USE ONLY
            </div>
          </div>
          <div style="margin-top: 12px; display: flex; gap: 30px; font-size: 13px; color: #475569;">
            <span><strong>Date Generated:</strong> ${new Date(result.timestamp).toLocaleDateString()}</span>
            <span><strong>System:</strong> SOX Auditor AI</span>
          </div>
        </div>
      `;
      element.prepend(pdfHeader);
      
      tempContainer.appendChild(element);

      const opt = {
        margin: [15, 10, 15, 10], 
        filename: `SOX_Audit_Memo_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          letterRendering: true,
          scrollY: 0,
          scrollX: 0,
          windowWidth: 1200, 
          logging: false
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      await h2p().set(opt).from(element).save();
      
    } catch (error: any) {
      console.error("PDF Export failed:", error);
      alert(`Export failed: ${error.message || 'Error occurred during PDF generation.'}`);
    } finally {
      if (document.body.contains(tempContainer)) {
        document.body.removeChild(tempContainer);
      }
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
                Generated Testing Memo
            </h2>
            <p className="text-xs text-brand-700 mt-1">
               {`Generated at ${new Date(result.timestamp).toLocaleTimeString()}`}
            </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleInputs}
            className="flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-900 bg-white/50 hover:bg-white px-3 py-1.5 rounded-md transition border border-brand-200"
            title={showInputs ? "Expand to full screen" : "Show control inputs"}
          >
             {showInputs ? (
                <>
                    <Maximize2 size={16} />
                    <span className="hidden sm:inline">Expand</span>
                </>
             ) : (
                <>
                    <PanelLeftOpen size={16} />
                    <span className="hidden sm:inline">Edit Inputs</span>
                </>
             )}
          </button>
          <div className="w-px h-6 bg-brand-200 mx-1"></div>
          
          <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-900 bg-white/50 hover:bg-white px-3 py-1.5 rounded-md transition border border-brand-200 disabled:opacity-50"
          >
              {isExporting ? (
                <span className="animate-spin h-4 w-4 border-2 border-brand-600 border-t-transparent rounded-full"></span>
              ) : (
                <FileDown size={16} />
              )}
              Export PDF
          </button>

          <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-900 bg-white/50 hover:bg-white px-3 py-1.5 rounded-md transition border border-brand-200"
          >
              <Copy size={16} />
              Copy Markdown
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-8 bg-white" ref={memoRef}>
        <EditableAuditMemo 
            key={result.timestamp} 
            initialContent={result.memo} 
            onUpdate={onUpdate} 
        />
      </div>
      
      {/* AI Refinement Section */}
      <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
        <div className="flex flex-col space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reviewer Inputs (AI Refinement)</label>
            <div className="flex gap-2">
                <input 
                    type="text" 
                    className="flex-1 px-4 py-2 text-sm bg-white text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder-slate-400"
                    placeholder="e.g., 'Change the conclusion to failed due to missing approval', 'Update sample size to 25'"
                    value={refineInput}
                    onChange={(e) => setRefineInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !isRefining && handleRefineSubmit()}
                    disabled={isRefining}
                />
                <button 
                    onClick={handleRefineSubmit}
                    disabled={isRefining || !refineInput.trim()}
                    className={`px-4 py-2 rounded-lg text-white text-sm font-medium flex items-center gap-2 transition
                        ${isRefining || !refineInput.trim() 
                            ? 'bg-brand-300 cursor-not-allowed' 
                            : 'bg-brand-600 hover:bg-brand-700'}`}
                >
                    {isRefining ? (
                        <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                    ) : (
                        <Wand2 size={16} />
                    )}
                    Refine
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
