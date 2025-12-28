
import React, { useState } from 'react';
import { AuditForm } from './components/AuditForm';
import { MemoDisplay } from './components/MemoDisplay';
import { AuditFormData, GenerationResult } from './types';
import { generateAuditMemo, refineAuditMemo } from './services/geminiService';
import { ShieldCheck, AlertCircle } from 'lucide-react';

const App: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [lastFormData, setLastFormData] = useState<AuditFormData | null>(null);
  const [error, setError] = useState<{ message: string; isTokenLimit?: boolean } | null>(null);
  
  const [showInputs, setShowInputs] = useState(true);

  const handleFormSubmit = async (data: AuditFormData) => {
    setIsProcessing(true);
    setError(null);
    setLastFormData(data); 
    
    try {
      const memoText = await generateAuditMemo(data);
      setResult({
        memo: memoText,
        timestamp: new Date().toISOString()
      });
      setShowInputs(false);
    } catch (err: any) {
      const isTokenLimit = err.message?.toLowerCase().includes('size') || err.message?.toLowerCase().includes('too large');
      setError({ message: err.message || "An unexpected error occurred.", isTokenLimit });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMemoUpdate = (newMemo: string) => {
    if (result) {
      setResult({
        ...result,
        memo: newMemo
      });
    }
  };

  const handleRefine = async (instructions: string) => {
    if (!result || !lastFormData) return;
    
    setIsRefining(true);
    setError(null);

    try {
      const updatedMemo = await refineAuditMemo(lastFormData, result.memo, instructions);
      setResult({
        ...result,
        memo: updatedMemo,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      setError({ message: err.message || "Failed to refine memo." });
    } finally {
      setIsRefining(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-brand-600 p-1.5 rounded-lg">
              <ShieldCheck className="text-white" size={24} />
            </div>
            <div>
                <h1 className="text-xl font-bold text-slate-900 leading-none">SOX Auditor AI</h1>
                <span className="text-xs text-slate-500 font-medium">Automated Control Testing</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
             <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">Gemini 3 Flash</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {error && (
          <div className={`mb-6 border px-4 py-3 rounded-lg flex items-start gap-3 shadow-sm ${error.isTokenLimit ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-700'}`} role="alert">
            <AlertCircle className={`mt-0.5 shrink-0 ${error.isTokenLimit ? 'text-amber-500' : 'text-red-500'}`} size={18} />
            <div className="flex-1">
              <strong className="font-bold mr-2">{error.isTokenLimit ? 'Capacity Limit:' : 'Error:'}</strong>
              <span className="block sm:inline text-sm">{error.message}</span>
            </div>
            <button onClick={() => setError(null)} className={`ml-auto font-bold ${error.isTokenLimit ? 'text-amber-500 hover:text-amber-700' : 'text-red-500 hover:text-red-700'}`}>×</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full items-start">
          <div className={`${showInputs ? 'lg:col-span-5 xl:col-span-4' : 'hidden'} space-y-6`}>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <strong>Instructions:</strong> Upload screenshots or PDFs of reports (PBCs). The AI will tickmark specific values and generate the testing conclusion.
            </div>
            <AuditForm onSubmit={handleFormSubmit} isProcessing={isProcessing} />
          </div>

          <div className={`${showInputs ? 'lg:col-span-7 xl:col-span-8' : 'lg:col-span-12'} h-full min-h-[600px]`}>
            <MemoDisplay 
              result={result} 
              onUpdate={handleMemoUpdate}
              onRefine={handleRefine}
              isRefining={isRefining}
              showInputs={showInputs}
              onToggleInputs={() => setShowInputs(!showInputs)}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
