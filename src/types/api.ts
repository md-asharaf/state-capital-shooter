export interface LabeledField {
  label: string;
  value: string;
}

export interface QuizQuestion {
  readonly prompt: LabeledField;
  readonly answer: LabeledField;
  readonly hint?: LabeledField;
  readonly options: readonly string[];
}

export interface ApiResponse<T> {
  success: boolean;
  message: string | null;
  data: T;
}
