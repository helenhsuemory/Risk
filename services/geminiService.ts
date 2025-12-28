
import { GoogleGenAI, Part } from "@google/genai";
import { AuditFormData } from "../types";

const SYSTEM_INSTRUCTION = `
You are an expert SOX auditor and compliance analyst. Your task is to assist in automating the control testing process by reviewing supporting evidence and documenting the results.

Your goal is to:
1. Review and analyze the PBC (Provided by Client) evidence in the context of the control and testing attributes.
2. **Generate a Test Sheet**: 
   - Document your testing in a structured Markdown Table.
   - The table MUST strictly include the following columns in this order:
     1. **Test Attribute**: The standard testing attribute category (e.g., Existence, Accuracy, Completeness).
     2. **Test Attribute Description**: 
        - If "Testing Attributes" are provided in the input, use those specific values.
        - If "Testing Attributes" are NOT provided, you MUST develop specific testing procedures. These procedures MUST start with an action verb (e.g., "Inspect", "Validate", "Reperform", "Verify", "Agree") and describe the action taken.
     3. **Tickmark**: ONLY use the values "Pass", "Fail", or "N/A" (plain text, no bold).
     4. **Testing Notes**: Detailed observations including the specific evidence reference (e.g., "Invoice #12345"), what was verified, and any exceptions found. Do NOT include the specific file page citation here; use the Reference column.
     5. **Reference**: Explicitly state the source here: "Page [X] in '[filename]'" or "Sheet [Name] in '[filename]'".
   - Ensure every key piece of evidence (e.g., each sample item or key report total) is represented in the table.
3. Apply appropriate audit judgment to identify whether the evidence supports the control's operating effectiveness.

Maintain an objective, professional tone. If the evidence is insufficient or missing, clearly state that the control could not be tested effectively.

**Output Structure:**
Provide the output strictly in the following format. **DO NOT** include a generic "Testing Procedure", "Methodology", or "Approach" section outside of the specific sections requested below.

## Testing Overview
| Section | Content |
| :--- | :--- |
| **Control Name** | [Autofill from input] |
| **Control Description** | [Shortened version of input] |
| **Control Objective** | [Brief objective derived from Control Description] |
| **Conclusion Summary** | [Effective / Ineffective] |

## Population and Sample
| Section | Content |
| :--- | :--- |
| **Population Completeness** | [Follow specific instructions based on frequency] |
| **Sample Period** | [Concise format aligning with frequency, e.g., "Q4 FY25" or "Dec 2025"] |
| **Sample Size** | [Number only, e.g., "1", "25"] |
| **Selection Methodology** | [e.g., Random, Haphazard] |
| **Special Considerations** | [Default to "N/A"] |

## Test Sheet
[The structured table defined above]

## Conclusion
[Conclusion on whether the control is operating effectively based on the evidence, and if not, explain why]
`;

const fileToGenerativePart = async (file: File): Promise<Part> => {
  const ext = file.name.split('.').pop()?.toLowerCase();

  // Handle Excel files by converting to CSV text
  if (ext === 'xlsx' || ext === 'xls') {
    try {
      // Dynamically import xlsx
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

      if (!content.trim()) {
        content = "Empty Excel file or no readable data found.";
      }

      const base64Data = btoa(unescape(encodeURIComponent(content)));

      return {
        inlineData: {
          data: base64Data,
          mimeType: 'text/plain'
        }
      };
    } catch (error) {
      console.error("Error processing Excel file:", error);
      throw new Error(`Failed to process Excel file ${file.name}.`);
    }
  }

  // Handle Word files by extracting raw text
  if (ext === 'docx') {
    try {
        // Dynamically import mammoth
        // @ts-ignore
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
        const textContent = result.value;
        
        const base64Data = btoa(unescape(encodeURIComponent(textContent)));

        return {
            inlineData: {
                data: base64Data,
                mimeType: 'text/plain'
            }
        };
    } catch (error) {
        console.error("Error processing Word file:", error);
        throw new Error(`Failed to process Word file ${file.name}.`);
    }
  }

  // Handle PowerPoint files
  if (ext === 'pptx') {
    try {
        // @ts-ignore
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(await file.arrayBuffer());
        
        // Filter for slide XML files
        const slideFiles = Object.keys(zip.files).filter(name => 
            name.match(/^ppt\/slides\/slide\d+\.xml$/)
        );

        // Sort slides numerically
        slideFiles.sort((a, b) => {
            const numA = parseInt(a.match(/slide(\d+)\.xml/)![1]);
            const numB = parseInt(b.match(/slide(\d+)\.xml/)![1]);
            return numA - numB;
        });

        let fullText = "";

        for (const fileName of slideFiles) {
            const slideXml = await zip.files[fileName].async("string");
            // Extract text from <a:t> tags (PowerPoint text)
            const matches = slideXml.match(/<a:t[^>]*>(.*?)<\/a:t>/g);
            if (matches) {
                const slideText = matches.map(m => m.replace(/<\/?a:t[^>]*>/g, '')).join(' ');
                const slideNum = fileName.match(/slide(\d+)\.xml/)![1];
                fullText += `\n--- Slide ${slideNum} ---\n${slideText}\n`;
            }
        }

        if (!fullText.trim()) {
            fullText = "Empty PowerPoint file or no readable text found.";
        }

        const base64Data = btoa(unescape(encodeURIComponent(fullText)));

        return {
            inlineData: {
                data: base64Data,
                mimeType: 'text/plain'
            }
        };

    } catch (error) {
        console.error("Error processing PowerPoint file:", error);
        throw new Error(`Failed to process PowerPoint file ${file.name}.`);
    }
  }

  // Handle other files (Images, PDFs, EML, CSV)
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      
      let mimeType = file.type;

      if (ext === 'eml' || mimeType === 'message/rfc822') {
        mimeType = 'text/plain';
      }
      if (ext === 'csv' && !mimeType) {
        mimeType = 'text/csv';
      }

      resolve({
        inlineData: {
          data: base64Data,
          mimeType: mimeType || 'application/octet-stream'
        }
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const generateAuditMemo = async (data: AuditFormData): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please check your environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Prepare file parts, wrapping them with filename text to provide context for citations
  const filePartsNested = await Promise.all(data.files.map(async (file) => {
    const part = await fileToGenerativePart(file);
    return [
        { text: `\n--- Start of File Reference: "${file.name}" ---\n` },
        part,
        { text: `\n--- End of File Reference: "${file.name}" ---\n` }
    ];
  }));
  const fileParts = filePartsNested.flat();

  let populationCompletenessInstruction = "Brief description of how completeness was ensured based on the evidence.";
  if (data.metadata.frequency === 'Quarterly') {
    populationCompletenessInstruction = "Strictly write: 'N/A - Control is performed at a quarterly frequency. Total annual population is 4.'";
  }

  const attributesInput = data.attributes && data.attributes.trim().length > 0
    ? data.attributes
    : "Not provided. Develop specific testing procedures starting with action verbs (e.g., 'Inspect', 'Validate', 'Reperform', 'Verify', 'Agree') based on the Control Description.";

  const promptText = `
    Please generate SOX Control Testing Documentation based on the following information:

    **Control Information:**
    - Control Name: ${data.controlName}
    - Control Description: ${data.controlDescription}
    - Testing Attributes: ${attributesInput}

    **Metadata:**
    - Control Owner: ${data.metadata.owner}
    - Control Preparer: ${data.metadata.preparer}
    - Frequency: ${data.metadata.frequency}
    - Risk Level: ${data.metadata.riskLevel}
    - Population Size: ${data.metadata.populationSize}
    - Sample Size: ${data.metadata.sampleSize}

    **Attached Evidence:**
    I have attached ${data.files.length} file(s) representing the PBC (Provided by Client) documentation. 
    
    Please strictly follow the structure:
    1. **Testing Overview** (Summary Table)
    2. **Population and Sample** (Summary Table)
       - Generate a markdown table with columns "Section" and "Content" containing the following rows:
       - **Population Completeness**: ${populationCompletenessInstruction}
       - **Sample Period**: Concise format aligning with frequency (e.g., "Q4 FY25" for Quarterly, "Dec 2025" for Monthly, "FY2025" for Annual).
       - **Sample Size**: Number only (e.g., "1", "25").
       - **Selection Methodology**: e.g., Random, Haphazard.
       - **Special Considerations**: Default to "N/A".
    3. **Test Sheet** (Markdown Table with columns: **Test Attribute**, **Test Attribute Description**, **Tickmark** (Pass/Fail/NA), **Testing Notes**, **Reference**).
       - **IMPORTANT**: 
         - **Test Attribute Description**: If input attributes are missing, develop procedures starting with action verbs (Inspect, Validate, Reperform).
         - **Tickmark**: ONLY use "Pass", "Fail", or "N/A" (plain text).
         - **Testing Notes**: Detailed observations.
         - **Reference**: MANDATORY. Explicitly state citation here: "Page [x] in '[filename]'".
    4. **Conclusion**

    **Specific Table Instructions:**
    - In the Testing Overview table, do NOT include "Testing Attributes". Instead, include a row for "**Control Objective**" and derive the objective from the control description.

    **IMPORTANT**: Do NOT include a "Testing Procedure" section.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { text: promptText },
          ...fileParts
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.3, 
      }
    });

    return response.text || "No response generated.";
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Failed to generate audit memo. Please try again.");
  }
};

export const refineAuditMemo = async (data: AuditFormData, currentMemo: string, instructions: string): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please check your environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Re-send files with filename wrappers for context
  const filePartsNested = await Promise.all(data.files.map(async (file) => {
    const part = await fileToGenerativePart(file);
    return [
        { text: `\n--- Start of File Reference: "${file.name}" ---\n` },
        part,
        { text: `\n--- End of File Reference: "${file.name}" ---\n` }
    ];
  }));
  const fileParts = filePartsNested.flat();

  const promptText = `
    I have a generated SOX Control Testing Memo. I need you to update it based on the Reviewer's feedback.

    **Current Memo Content:**
    ${currentMemo}

    **Reviewer Instructions for Update:**
    ${instructions}

    **Task:**
    1. Update the memo strictly following the reviewer's instructions.
    2. You have access to the original evidence files if you need to verify information (filenames are provided in wrappers).
    3. Maintain the existing Markdown structure (tables, headers) unless asked to change it.
    4. Ensure the Test Sheet table maintains the columns: Test Attribute, Test Attribute Description, Tickmark, Testing Notes, Reference.
    5. **Tickmark Column**: Keep values strictly as "Pass", "Fail", or "N/A" (plain text).
    6. Return ONLY the updated Markdown memo. Do not add conversational filler.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { text: promptText },
          ...fileParts
        ]
      },
      config: {
        systemInstruction: "You are an expert SOX auditor. You are refining an existing testing memo based on reviewer feedback.",
        temperature: 0.3, 
      }
    });

    return response.text || currentMemo;
  } catch (error) {
    console.error("Error calling Gemini API for refinement:", error);
    throw new Error("Failed to refine audit memo. Please try again.");
  }
};