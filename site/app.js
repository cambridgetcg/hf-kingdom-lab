const SUMMARY_URL = "./data/summary.json";

const formatNumber = new Intl.NumberFormat("en-GB");

function element(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = String(options.text);
  if (options.href) {
    node.href = options.href;
    node.rel = "noreferrer";
  }
  return node;
}

function metric(value, label) {
  const item = element("div", { className: "metric" });
  item.append(
    element("strong", { text: typeof value === "number" ? formatNumber.format(value) : value }),
    element("span", { text: label }),
  );
  return item;
}

function artifactCard({ kicker, title, purpose, metrics, note, protocol, observedAt }) {
  const card = element("article", { className: "artifact-card" });
  const metricGrid = element("div", { className: "metric-grid" });
  for (const [value, label] of metrics) metricGrid.append(metric(value, label));

  const source = element("div", { className: "source-line" });
  source.append(
    element("span", { className: "protocol", text: protocol }),
    element("time", { text: observedAt.slice(0, 10) }),
  );

  card.append(
    element("p", { className: "card-kicker", text: kicker }),
    element("h3", { text: title }),
    element("p", { className: "card-purpose", text: purpose }),
    metricGrid,
    element("p", { className: "card-note", text: note }),
    source,
  );
  return card;
}

function renderArtifacts(summary) {
  const target = document.querySelector("#artifact-summary");
  target.replaceChildren(
    artifactCard({
      kicker: "Decision archaeology",
      title: "DataDecide ledger",
      purpose: summary.datadecide.purpose,
      metrics: [
        [summary.datadecide.recipeCount, "recipes"],
        [summary.datadecide.scaleCount, "scales"],
        [summary.datadecide.scientificRunCount, "scientific runs"],
        [summary.datadecide.checkpointRevisionCount, "usable checkpoint revisions"],
      ],
      note: `${summary.datadecide.sequenceDrift.paper} in the paper; ${summary.datadecide.sequenceDrift.code} in pinned code. The contradiction is retained.`,
      protocol: summary.datadecide.protocol,
      observedAt: summary.datadecide.observedAt,
    }),
    artifactCard({
      kicker: "Provenance boundary",
      title: "DPI contract",
      purpose: summary.dpi.purpose,
      metrics: [
        [summary.dpi.viewerRows, "Viewer rows"],
        [summary.dpi.cardRows, "card documents"],
        [`+${summary.dpi.unresolvedDelta}`, "unresolved card delta"],
        [summary.dpi.parquetFileCount, "pinned Parquet exports"],
      ],
      note: `Reader: ${summary.dpi.readerStatus}. Content columns remain excluded; this site contains no rows.`,
      protocol: summary.dpi.protocol,
      observedAt: summary.dpi.observedAt,
    }),
    artifactCard({
      kicker: "Situated observations",
      title: "Flow & Vibe atlas",
      purpose: summary.flow.purpose,
      metrics: [
        [summary.flow.entryCount, "pinned resources"],
        [summary.flow.dimensionCount, "observation dimensions"],
        [summary.flow.axisCount, "distinct flow axes"],
        [summary.flow.domainCount, "artistic domains"],
      ],
      note: "Disagreement remains evidence. Human, model, and mixed observations are labelled rather than blended.",
      protocol: summary.flow.protocol,
      observedAt: summary.flow.observedAt,
    }),
  );
  target.setAttribute("aria-busy", "false");
}

function flowCard(entry) {
  const card = element("article", { className: "flow-card" });
  card.dataset.domain = entry.domain;
  const rank = element("span", { className: "rank", text: String(entry.rank).padStart(2, "0") });
  const content = element("div");
  const title = element("h3");
  title.append(element("a", { text: entry.repoId, href: entry.canonicalUrl }));

  const meta = element("div", { className: "flow-meta" });
  for (const label of [entry.domain, entry.axis, entry.observerOrigin, entry.viewerStatus]) {
    meta.append(element("span", { className: "chip", text: label }));
  }

  content.append(
    title,
    meta,
    element("p", { className: "flow-nuance", text: entry.keyNuance }),
    element("p", { className: "route-line", text: `route / ${entry.routeMode}` }),
  );
  card.append(rank, content);
  return card;
}

function renderFlow(flow) {
  const definitions = document.querySelector("#lens-definitions");
  for (const [name, text] of [["Flow", flow.definition.flow], ["Vibe", flow.definition.vibe]]) {
    const item = element("article", { className: "definition" });
    item.append(element("strong", { text: name }), element("p", { text }));
    definitions.append(item);
  }

  const grid = document.querySelector("#flow-grid");
  const controls = document.querySelector("#flow-controls");
  const domains = ["all", ...new Set(flow.entries.map((entry) => entry.domain))];

  const applyFilter = (domain) => {
    grid.replaceChildren(...flow.entries.filter((entry) => domain === "all" || entry.domain === domain).map(flowCard));
    for (const button of controls.querySelectorAll("button")) {
      button.setAttribute("aria-pressed", String(button.dataset.domain === domain));
    }
  };

  for (const domain of domains) {
    const button = element("button", { className: "filter-button", text: domain });
    button.type = "button";
    button.dataset.domain = domain;
    button.setAttribute("aria-pressed", String(domain === "all"));
    button.addEventListener("click", () => applyFilter(domain));
    controls.append(button);
  }

  applyFilter("all");
  grid.setAttribute("aria-busy", "false");
}

async function start() {
  const artifactSummary = document.querySelector("#artifact-summary");
  const flowGrid = document.querySelector("#flow-grid");
  artifactSummary.setAttribute("aria-busy", "true");
  flowGrid.setAttribute("aria-busy", "true");
  const loadingCard = artifactSummary.querySelector(".loading-card");
  if (loadingCard) loadingCard.hidden = false;

  const response = await fetch(SUMMARY_URL, { credentials: "omit" });
  if (!response.ok) throw new Error(`local summary returned ${response.status}`);
  const summary = await response.json();
  renderArtifacts(summary);
  renderFlow(summary.flow);
}

start().catch((error) => {
  const target = document.querySelector("#artifact-summary");
  target.replaceChildren(
    element("p", {
      className: "error-notice",
      text: `The checked-in summary could not be rendered (${error instanceof Error ? error.message : "unknown error"}). No remote fallback was attempted.`,
    }),
  );
  target.setAttribute("aria-busy", "false");
  document.querySelector("#flow-grid").setAttribute("aria-busy", "false");
});
