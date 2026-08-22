import type { ApiResponse, QuizQuestion } from '../types/api';

export async function fetchQuizData(): Promise<QuizQuestion[]> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  const projectId = import.meta.env.VITE_PROJECT_ID;

  if (!baseUrl || !projectId) {
    throw new Error("Missing VITE_API_BASE_URL or VITE_PROJECT_ID environment variables.");
  }

  const endpoint = `${baseUrl.replace(/\/$/, '')}/projects/${projectId}/quiz`;

  const response = await fetch(endpoint);

  if (!response.ok) {
    let errorMessage = `HTTP Error: ${response.status} ${response.statusText}`;
    try {
      const errorBody = await response.json();
      if (errorBody && errorBody.error) {
        errorMessage = errorBody.error;
      } else if (errorBody && errorBody.message) {
        errorMessage = errorBody.message;
      }
    } catch {
    }
    throw new Error(errorMessage);
  }

  const result: ApiResponse<QuizQuestion[]> = await response.json();
  if (!result.success) {
    throw new Error(result.message || "Unknown error fetching quiz data");
  }

  return result.data;
}
