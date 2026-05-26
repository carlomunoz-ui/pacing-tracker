export interface Campaign {
  oppId: string;
  oppName: string;
  oc: string;
  agencia: string;
  cliente: string;
  motivo: string;
  tipoCompra: string;
  formato: string;
  inversionRaw: string;
  inversionValue: number;
  currency: 'USD' | 'PEN';
  cpmRaw: string;
  cpmValue: number;
  objectiveRaw: string;
  objectiveValue: number;
  fechaInicio: string;
  fechaFin: string;
  mes: string;
  avanceRaw: string;
  avanceValue: number;
  pacingRaw: string;
  pacingValue: number; // e.g. 101.9 for 101.90%
  // Optional Direct Analytics rich metrics
  impressionsValue?: number;
  clicksValue?: number;
  clicks?: number;
  sesionesValue?: number;
  erValue?: number;
  vtrValue?: number;
  vtr?: number;
  ctrValue?: number;
}

export interface KPIStats {
  totalInversionUSD: number;
  totalInversionPEN: number;
  campaignCount: number;
  activeCampaigns: number;
  averagePacing: number;
  optimalCount: number;
  underperformingCount: number;
  overperformingCount: number;
}

export interface AISummary {
  generalReport: string;
  anomalies: CampaignAnomaly[];
  recommendations: CampaignRecommendation[];
  generatedAt: string;
}

export interface CampaignAnomaly {
  oppId: string;
  oppName: string;
  cliente: string;
  severity: 'high' | 'medium' | 'low';
  issue: string;
  metrics: {
    inversion: string;
    pacing: string;
    avance: string;
    obj: string;
  };
}

export interface CampaignRecommendation {
  sourceOppId: string;
  targetOppId: string;
  action: string;
  justification: string;
  estimatedImpact: string;
}
