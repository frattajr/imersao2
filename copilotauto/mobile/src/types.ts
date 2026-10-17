/** Espelho de `backend/app/schemas.py`. */

export type Status = 'GREEN' | 'YELLOW' | 'RED' | 'INCONCLUSIVE';

export interface AnalysisResult {
  component_id: string;
  status: Status;
  confidence_score: number;
  visual_findings: string;
  risk_assessment: string;
  is_negotiation_lever: boolean;
  estimated_cost_min: number;
  estimated_cost_max: number;
  legal_disclaimer: string;
  user_guidance_next_step: string;
}

export interface Vehicle {
  make: string;
  model: string;
  year: number;
  km: number;
  vin?: string | null;
  plate?: string | null;
  asking_price?: number | null;
}

export interface Inspection {
  id: string;
  vehicle: Vehicle;
  terms_version: string;
  created_at: string;
}

export interface NegotiationLever {
  component_id: string;
  label: string;
  position: string | null;
  status: Status;
  cost_min: number;
  cost_max: number;
  argument: string;
}

export interface Report {
  inspection: Inspection;
  findings: { position: string | null; result: AnalysisResult; created_at: string }[];
  missing_components: string[];
  negotiation: {
    levers: NegotiationLever[];
    total_cost_min: number;
    total_cost_max: number;
    asking_price: number | null;
    suggested_offer: number | null;
    walk_away_price: number | null;
    discount_capped: boolean;
    recommend_professional_inspection: boolean;
    recommendation: string;
  };
  legal_notice: string;
}
