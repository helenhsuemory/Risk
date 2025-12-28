import React, { useState, useRef, useEffect } from 'react';
import { AuditFormData, ControlMetadata } from '../types';
import { Upload, FileText, X } from 'lucide-react';

interface AuditFormProps {
  onSubmit: (data: AuditFormData) => void;
  isProcessing: boolean;
}

export const AuditForm: React.FC<AuditFormProps> = ({ onSubmit, isProcessing }) => {
  const [controlName, setControlName] = useState('');
  const [controlDescription, setControlDescription] = useState('');
  const [attributes, setAttributes] = useState('Accuracy\nCompleteness\nValidity');
  const [files, setFiles] = useState<File[]>([]);
  
  const [metadata, setMetadata] = useState<ControlMetadata>({
    owner: '',
    preparer: '',
    frequency: 'Monthly',
    riskLevel: 'Low',
    populationSize: '',
    sampleSize: '1',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-detect Frequency based on Description
  useEffect(() => {
    const desc = controlDescription.toLowerCase();
    let newFreq = '';

    if (desc.includes('daily')) newFreq = 'Daily';
    else if (desc.includes('weekly')) newFreq = 'Weekly';
    else if (desc.includes('monthly')) newFreq = 'Monthly';
    else if (desc.includes('quarterly')) newFreq = 'Quarterly';
    else if (desc.includes('annually') || desc.includes('annual')) newFreq = 'Annually';

    if (newFreq && newFreq !== metadata.frequency) {
      setMetadata(prev => ({ ...prev, frequency: newFreq }));
    }
  }, [controlDescription]);

  // Auto-update Population and Sample Size based on Frequency and Risk
  useEffect(() => {
    const { frequency, riskLevel } = metadata;
    let pop = '';
    let sample = '';

    switch (frequency) {
      case 'Daily':
        pop = '250+';
        sample = riskLevel === 'High' ? '40' : '25';
        break;
      case 'Weekly':
        pop = '52';
        sample = riskLevel === 'High' ? '10' : '5';
        break;
      case 'Monthly':
        pop = '12';
        sample = riskLevel === 'High' ? '4' : '2';
        break;
      case 'Quarterly':
        pop = '4';
        sample = riskLevel === 'High' ? '2' : '2';
        break;
      case 'Annually':
        pop = '1';
        sample = '1';
        break;
      default: // Event-Driven or other
        pop = '';
        sample = riskLevel === 'High' ? '25' : '1';
        break;
    }

    setMetadata(prev => {
        // Only update if values differ to avoid unnecessary renders or overriding user input aggressively 
        // (though here we enforce the logic when deps change)
        if (prev.populationSize === pop && prev.sampleSize === sample) return prev;
        return { ...prev, populationSize: pop, sampleSize: sample };
    });
  }, [metadata.frequency, metadata.riskLevel]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      controlName,
      controlDescription,
      attributes,
      metadata,
      files
    });
  };

  const inputClasses = "w-full bg-white text-black rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition placeholder-slate-400";

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Control Definition</h3>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Control Name</label>
          <input
            type="text"
            required
            className={inputClasses}
            placeholder="e.g., FIN-001 Bank Reconciliation"
            value={controlName}
            onChange={(e) => setControlName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Control Description</label>
          <textarea
            required
            rows={4}
            className={inputClasses}
            placeholder="Describe the control activity (e.g., Monthly bank reconciliations are performed...)"
            value={controlDescription}
            onChange={(e) => setControlDescription(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Testing Attributes</h3>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Attributes to Test</label>
          <textarea
             rows={4}
             className={`${inputClasses} font-mono`}
             placeholder="Enter attributes (one per line or comma separated)...&#10;Accuracy&#10;Completeness&#10;Validity"
             value={attributes}
             onChange={(e) => setAttributes(e.target.value)}
          />
          <p className="text-xs text-slate-500 mt-1">List the specific testing attributes required for this control.</p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Control Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Control Owner</label>
            <input
              type="text"
              className={inputClasses}
              value={metadata.owner}
              onChange={(e) => setMetadata({...metadata, owner: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Control Preparer</label>
            <input
              type="text"
              className={inputClasses}
              value={metadata.preparer}
              onChange={(e) => setMetadata({...metadata, preparer: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Frequency</label>
            <select
              className={inputClasses}
              value={metadata.frequency}
              onChange={(e) => setMetadata({...metadata, frequency: e.target.value})}
            >
              <option>Daily</option>
              <option>Weekly</option>
              <option>Monthly</option>
              <option>Quarterly</option>
              <option>Annually</option>
              <option>Event-Driven</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Risk Level</label>
            <select
              className={inputClasses}
              value={metadata.riskLevel}
              onChange={(e) => setMetadata({...metadata, riskLevel: e.target.value})}
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </div>
          <div className="flex gap-4 md:col-span-2">
             <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Population</label>
                <input
                  type="text"
                  className={inputClasses}
                  placeholder="e.g. 450"
                  value={metadata.populationSize}
                  onChange={(e) => setMetadata({...metadata, populationSize: e.target.value})}
                />
             </div>
             <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Sample Size</label>
                <input
                  type="text"
                  className={inputClasses}
                  value={metadata.sampleSize}
                  onChange={(e) => setMetadata({...metadata, sampleSize: e.target.value})}
                />
             </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-end border-b pb-2">
          <h3 className="text-lg font-semibold text-slate-800">Evidence (PBC)</h3>
          <span className="text-xs text-slate-500">Supported: PDF, Images, Excel, EML, DOCX, PPTX</span>
        </div>
        
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-brand-500 hover:bg-brand-50 transition group bg-slate-50"
        >
          <Upload className="text-slate-400 group-hover:text-brand-500 mb-2" size={32} />
          <p className="text-sm text-slate-600 font-medium">Click to upload evidence</p>
          <p className="text-xs text-slate-400 mt-1">Upload screenshots, reports, emails, spreadsheets, or presentations</p>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            multiple 
            accept="image/*,.pdf,.csv,.xlsx,.xls,.eml,.docx,.doc,.pptx"
            className="hidden" 
          />
        </div>

        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((file, index) => (
              <div key={index} className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-200">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div className="bg-white p-1 rounded border border-slate-200">
                    <FileText size={16} className="text-brand-600" />
                  </div>
                  <span className="text-sm text-slate-700 truncate max-w-[200px]">{file.name}</span>
                  <span className="text-xs text-slate-400">({(file.size / 1024).toFixed(0)} KB)</span>
                </div>
                <button 
                  type="button"
                  onClick={() => removeFile(index)}
                  className="text-slate-400 hover:text-red-500 transition p-1"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-4">
        <button
          type="submit"
          disabled={isProcessing}
          className={`w-full py-3 px-4 rounded-lg text-white font-medium shadow-sm flex justify-center items-center space-x-2 transition
            ${isProcessing 
              ? 'bg-slate-400 cursor-not-allowed' 
              : 'bg-brand-600 hover:bg-brand-700 active:bg-brand-800'
            }`}
        >
          {isProcessing ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Analyzing Evidence...</span>
            </>
          ) : (
            <span>Generate Testing Memo</span>
          )}
        </button>
      </div>
    </form>
  );
};