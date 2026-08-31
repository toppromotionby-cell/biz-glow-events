// Клиент-безопасное представление плана (без сырых аргументов инструментов).
export interface PlanStepDTO {
  label: string;
  tool: string;
}

export interface PlanResearchDTO {
  title: string;
  url: string;
  snippet: string;
}

export interface PlanDTO {
  id: string;
  status: string;
  title: string;
  summary: string;
  request: string;
  steps: PlanStepDTO[];
  research: PlanResearchDTO[];
  questions: string[];
  result: string;
  created_at: string;
}
