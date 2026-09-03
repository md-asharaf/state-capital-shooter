export interface QuizQuestion {
  readonly question: string;
  readonly answer: string;
  readonly hint?: string;
  readonly options: readonly string[];
}

export interface ApiResponse<T> {
  success: boolean;
  message: string | null;
  data: T;
}
