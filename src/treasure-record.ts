import {
  DEFAULT_DATA_ROOT,
  ingestResources,
  type IngestOptions,
  type IngestResult,
} from "./lab.ts";
import {
  observeTreasure,
  type DatasetTreasure,
  type ObserveTreasureOptions,
  type TreasureDriftReport,
} from "./treasures.ts";

export interface RecordTreasureOptions extends ObserveTreasureOptions {
  root?: string;
  ingester?: (options: IngestOptions) => Promise<IngestResult>;
}

export interface TreasureRecordResult {
  protocol: "hf-kingdom-dataset-treasure-record/v1";
  repo_id: string;
  pinned_revision: string;
  catalogue_route: DatasetTreasure["kingdom_route"]["mode"];
  drift: TreasureDriftReport;
  agenttool: IngestResult;
  limits: string[];
}

export async function recordTreasureMetadata(
  treasure: DatasetTreasure,
  options: RecordTreasureOptions = {},
): Promise<TreasureRecordResult> {
  const observed = await observeTreasure(treasure, {
    ...(options.observer ? { observer: options.observer } : {}),
    ...(options.now ? { now: options.now } : {}),
  });
  if (observed.drift.identity_changed) {
    throw new Error(
      "pinned dataset identity changed; review and update the treasure card before recording",
    );
  }

  const ingester = options.ingester ?? ingestResources;
  const agenttool = await ingester({
    root: options.root ?? DEFAULT_DATA_ROOT,
    resources: [{ resource_type: "dataset", repo_id: treasure.repo_id }],
    now: () => new Date(observed.drift.checked_at),
    observer: async (kind, repoId) => {
      if (kind !== "dataset" || repoId !== treasure.repo_id) {
        throw new Error("record observer escaped the curated dataset identity");
      }
      return observed.snapshot;
    },
  });

  return {
    protocol: "hf-kingdom-dataset-treasure-record/v1",
    repo_id: treasure.repo_id,
    pinned_revision: treasure.revision,
    catalogue_route: treasure.kingdom_route.mode,
    drift: observed.drift,
    agenttool,
    limits: [
      "The checked-in treasure analysis remains in the versioned catalogue",
      "AgentTool received a newly reconstructed allowlisted copy of current public Hub metadata and an effects receipt only",
      "No dataset row, repository file, prompt, response, profile, or participant/user identifier was read or stored",
    ],
  };
}
