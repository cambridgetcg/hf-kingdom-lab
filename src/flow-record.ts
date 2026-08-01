import {
  DEFAULT_DATA_ROOT,
  ingestResources,
  type IngestOptions,
  type IngestResult,
} from "./lab.ts";
import {
  observeFlowLens,
  type FlowLens,
  type FlowLensDriftReport,
  type ObserveFlowLensOptions,
} from "./flow-lenses.ts";

export interface RecordFlowLensOptions extends ObserveFlowLensOptions {
  root?: string;
  ingester?: (options: IngestOptions) => Promise<IngestResult>;
}

export interface FlowLensRecordResult {
  protocol: "hf-kingdom-flow-lens-record/v1";
  repo_id: string;
  pinned_revision: string;
  lens: {
    domain: FlowLens["domain"];
    axis: FlowLens["flow"]["axis"];
    observer_origin: FlowLens["evidence"]["observer_origin"];
    route: FlowLens["route"]["mode"];
  };
  drift: FlowLensDriftReport;
  agenttool: IngestResult;
  limits: string[];
}

export async function recordFlowLensMetadata(
  entry: FlowLens,
  options: RecordFlowLensOptions = {},
): Promise<FlowLensRecordResult> {
  const observed = await observeFlowLens(entry, {
    ...(options.observer ? { observer: options.observer } : {}),
    ...(options.now ? { now: options.now } : {}),
  });
  if (observed.drift.identity_changed) {
    throw new Error(
      "pinned flow-lens identity changed; review the catalogue before recording",
    );
  }

  const ingester = options.ingester ?? ingestResources;
  const agenttool = await ingester({
    root: options.root ?? DEFAULT_DATA_ROOT,
    resources: [{ resource_type: "dataset", repo_id: entry.repo_id }],
    now: () => new Date(observed.drift.checked_at),
    observer: async (kind, repoId) => {
      if (kind !== "dataset" || repoId !== entry.repo_id) {
        throw new Error("record observer escaped the curated flow-lens identity");
      }
      return observed.snapshot;
    },
  });

  return {
    protocol: "hf-kingdom-flow-lens-record/v1",
    repo_id: entry.repo_id,
    pinned_revision: entry.revision,
    lens: {
      domain: entry.domain,
      axis: entry.flow.axis,
      observer_origin: entry.evidence.observer_origin,
      route: entry.route.mode,
    },
    drift: observed.drift,
    agenttool,
    limits: [
      "AgentTool received a newly reconstructed allowlisted copy of current public Hub metadata and an effects receipt only",
      "The checked-in flow analysis remains versioned in the catalogue",
      "No dataset row, repository file, prompt, response, image, audio, profile, or participant/user identifier was read or stored",
      "Recording a lens does not authorize its future content route",
    ],
  };
}
