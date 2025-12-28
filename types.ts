export enum TestingAttribute {
  EXISTENCE = 'Existence',
  ACCURACY = 'Accuracy',
  COMPLETENESS = 'Completeness',
  VALIDITY = 'Validity',
  CUTOFF = 'Cutoff',
  VALUATION = 'Valuation',
  RIGHTS_OBLIGATIONS = 'Rights & Obligations',
  TIMELINESS = 'Timeliness',
  AUTHORIZATION = 'Authorization'
}

export interface ControlMetadata {
  owner: string;
  preparer: string;
  frequency: string;
  riskLevel: string;
  populationSize: string;
  sampleSize: string;
}

export interface AuditFormData {
  controlName: string;
  controlDescription: string;
  attributes: string;
  metadata: ControlMetadata;
  files: File[];
}

export interface GenerationResult {
  memo: string;
  timestamp: string;
}