export type SourceName = "aqar" | "bayut" | "dealapp";

export interface StagingListingRow {
  source: SourceName;
  external_id: string;
  payload: Record<string, unknown>;
}
