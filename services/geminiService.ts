
import { GoogleGenAI, Part } from "@google/genai";
import { AuditFormData } from "../types";

const SYSTEM_INSTRUCTION = `
You are an expert SOX auditor and Internal Audit (IA) professional. Your task is to assist in automating the control testing process by reviewing supporting evidence and documenting results in a professional audit workpaper format.

Your goal is to:
1. Review and analyze the PBC (Provided by Client) evidence in the context of the control and testing attributes.
2. **Generate a Test Sheet**: 
   - Document your testing in a structured Markdown Table.
   - The table MUST strictly include the following columns in this order:
     1. **Test Attribute**: Use alphabetical labels starting from "A" for each row (e.g., A, B, C, D...).
     2. **Test Attribute Description**: 
        - **STRICT REQUIREMENT**: If "Testing Attributes" are provided in the input, you MUST test ONLY those specific attributes. DO NOT invent or add additional attributes beyond what the user provided.
        - If "Testing Attributes" are NOT provided, you MUST develop specific testing procedures starting with an action verb (e.g., "Inspect", "Validate", "Reperform").
     3. **Tickmark**: ONLY use the values "Pass", "Fail", or "N/A" (plain text, no bold).
     4. **Testing Notes (IA Documentation Tone)**: 
        - **MANDATORY TONE**: Use formal Internal Audit documentation language. 
        - Start notes with phrases like: "Per inspection of the provided evidence, IA determined that...", "IA verified...", "IA noted...", "IA confirmed...", "IA performed a reperformance of...".
        - Describe specific observations: "IA noted that the [Document] was signed by [Person] on [Date], which is within the required timeframe."
     5. **Reference**: Explicitly state the source: "Page [X] in '[filename]'" or "Sheet [Name] in '[filename]'".
   - Ensure every key piece of evidence (e.g., each sample item) is represented in the table as per the provided attributes.
3. Apply appropriate audit judgment to identify whether the evidence supports the control's operating effectiveness.

Maintain an objective, professional, and skeptical tone. If the evidence is insufficient or missing, clearly state that the control could not be tested effectively.

**Output Structure:**
Provide the output strictly in the following format.

## Testing Overview
| Section | Content |
| :--- | :--- |
| **Control Name** | [Autofill from input] |
| **Control Description** | [Shortened version of input] |
| **Control Objective** | [Brief objective derived from Control Description] |
| **Risk** | [Briefly describe the specific financial reporting risk this control mitigates] |
| **Risk Assertion** | [Inferred from the control, e.g., Accuracy, Completeness, Existence, Valuation, Cutoff] |
| **Risk Level** | [Autofill from metadata riskLevel] |
| **Conclusion Summary** | [Effective / Ineffective / Insufficient Evidence] |

## Population and Sample
| Section | Content |
| :--- | :--- |
| **Population Completeness** | [Describe how completeness was validated or noted from PBC] |
| **Sample Period** | [Concise format, e.g., "Q4 FY25"] |
| **Sample Size** | [Number only, e.g., "25"] |
| **Selection Methodology** | [e.g., Random, Haphazard] |
| **Special Considerations** | [Default to "N/A"] |

## Test Sheet
[The structured table defined above with IA documentation tone]

## Conclusion
[Formal IA conclusion on whether the control is operating effectively based on the evidence, and if not, explain why using audit terminology]
`;

const MAX_CHARS_PER_FILE = 800000;

const truncateText = (text: string): string => {
  if (text.length <= MAX_CHARS_PER_FILE) return text;
  return text.substring(0, MAX_CHARS_PER_FILE) + "\n\n[CONTENT TRUNCATED DUE TO SIZE LIMITS]";
};

const fileToGenerativePart = async (file: File): Promise<Part> => {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'xlsx' || ext === 'xls') {
    try {
      // @ts-ignore
      const XLSX = await import('xlsx');
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      let content = "";
      workbook.SheetNames.forEach((sheetName: string) => {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        if (csv && csv.trim().length > 0) {
            content += `\n--- Sheet: ${sheetName} ---\n${csv}\n`;
        }
      });
      const truncatedContent = truncateText(content || "Empty Excel file.");
      return { inlineData: { data: btoa(unescape(encodeURIComponent(truncatedContent))), mimeType: 'text/plain' } };
    } catch (error) {
      throw new Error(`Failed to process Excel file ${file.name}.`);
    }
  }

  if (ext === 'docx') {
    try {
        // @ts-ignore
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
        return { inlineData: { data: btoa(unescape(encodeURIComponent(truncateText(result.value)))), mimeType: 'text/plain' } };
    } catch (error) {
        throw new Error(`Failed to process Word file ${file.name}.`);
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type || 'application/octet-stream'
        }
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const generateAuditMemo = async (data: AuditFormData): Promise<string> => {
  if (!process.env.API_KEY) throw new Error("API Key is missing.");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const filePartsNested = await Promise.all(data.files.map(async (file) => {
    const part = await fileToGenerativePart(file);
    return [{ text: `\n--- Start of File: "${file.name}" ---\n` }, part, { text: `\n--- End of File: "${file.name}" ---\n` }];
  }));
  const fileParts = filePartsNested.flat();

  const attributesInput = data.attributes && data.attributes.trim().length > 0
    ? `The user has provided these EXACT testing attributes. IA MUST test ONLY these and no others: ${data.attributes}`
    : "No specific attributes provided. IA MUST develop specific testing procedures based on the control description.";

  const promptText = `
    Generate SOX Control Testing Workpaper Documentation.
    
    **Control Information:**
    - Control Name: ${data.controlName}
    - Control Description: ${data.controlDescription}
    - Testing Attributes: ${attributesInput}

    **Metadata:**
    - Owner/Preparer: ${data.metadata.owner} / ${data.metadata.preparer}
    - Frequency: ${data.metadata.frequency}
    - Risk Level: ${data.metadata.riskLevel}
    - Population/Sample: ${data.metadata.populationSize} / ${data.metadata.sampleSize}

    **Evidence Attached:** ${data.files.length} PBC file(s).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [{ text: promptText }, ...fileParts] },
      config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.1 }
    });
    return response.text || "No response generated.";
  } catch (error: any) {
    throw new Error(error?.message || "Failed to generate audit memo.");
  }
};

export const refineAuditMemo = async (data: AuditFormData, currentMemo: string, instructions: string): Promise<string> => {
  if (!process.env.API_KEY) throw new Error("API Key is missing.");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const filePartsNested = await Promise.all(data.files.map(async (file) => {
    const part = await fileToGenerativePart(file);
    return [{ text: `\n--- Start of File: "${file.name}" ---\n` }, part, { text: `\n--- End of File: "${file.name}" ---\n` }];
  }));
  const fileParts = filePartsNested.flat();

  const promptText = `Update this SOX memo per IA standards. Reviewer Feedback: ${instructions}\n\nCurrent Memo: ${currentMemo}`;
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts: [{ text: promptText }, ...fileParts] },
    config: { systemInstruction: "You are an expert Internal Auditor refining a testing workpaper. Maintain formal documentation tone.", temperature: 0.1 }
  });
  return response.text || currentMemo;
};
