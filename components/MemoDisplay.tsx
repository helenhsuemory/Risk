
import React, { useState } from 'react';
import { GenerationResult } from '../types';
import { EditableAuditMemo } from './MarkdownRenderer'; // Importing the now editable component
import { Copy, CheckCircle, FileCheck, Wand2, Maximize2, PanelLeftOpen } from 'lucide-react';

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
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-900 bg-white/50 hover:bg-white px-3 py-1.5 rounded-md transition border border-brand-200"
          >
              <Copy size={16} />
              Copy Markdown
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-8 bg-white">
        {/* 
          We use result.timestamp as the key to force a re-mount ONLY when 
          a NEW memo is generated or refined. This preserves local focus and 
          cursor state during manual edits, as onUpdate won't trigger a key change.
        */}
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
