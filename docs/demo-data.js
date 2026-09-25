const HEADER = ["Preparation", "Sex", "Sample ID", "Target", "Task", "Cq", "Quantity"];

const preparations = [
  { name: "Atlas", factor: 0.18, ctShift: 2.45 },
  { name: "Borealis", factor: 0.52, ctShift: 0.95 },
  { name: "Cygnus", factor: 0.68, ctShift: 0.55 },
  { name: "Draco", factor: 1.0, ctShift: 0 },
  { name: "Equinox", factor: 1.65, ctShift: -0.72 },
  { name: "Fenix", factor: 0.8, ctShift: 0.32 },
];

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(rows) {
  return [HEADER, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function measurementRows(term) {
  const rows = [];
  preparations.forEach((preparation, preparationIndex) => {
    for (let sampleIndex = 1; sampleIndex <= 8; sampleIndex += 1) {
      const sample = `S${String(sampleIndex).padStart(2, "0")}`;
      const sex = sampleIndex % 2 ? "F" : "M";
      const baselineQty = 90 + preparationIndex * 14 + sampleIndex * 5;
      const baselineCq = 22 + preparationIndex * 0.28 + sampleIndex * 0.09;
      let quantity = baselineQty;
      let cq = baselineCq;
      if (term === "T1") {
        const deterministicVariation = 1 + ((sampleIndex % 3) - 1) * 0.035;
        quantity = baselineQty * preparation.factor * deterministicVariation;
        cq = baselineCq + preparation.ctShift + ((sampleIndex % 2) ? 0.08 : -0.08);
      }
      if (preparation.name === "Draco" && term === "T1") {
        const direction = sampleIndex <= 4 ? 0.94 : 1.06;
        quantity = baselineQty * direction;
        cq = baselineCq - Math.log2(direction);
      }
      if (preparation.name === "Fenix" && term === "T1" && sampleIndex >= 7) {
        rows.push([preparation.name, sex, sample, "Synthetic target", "Unknown", "Undetermined", ""]);
        continue;
      }
      rows.push([preparation.name, sex, sample, "Synthetic target", "Unknown", cq.toFixed(3), quantity.toFixed(4)]);
      if (preparation.name === "Draco" && term === "T1" && sampleIndex === 3) {
        rows.push([preparation.name, sex, sample, "Synthetic target", "Unknown", cq.toFixed(3), quantity.toFixed(4)]);
      }
    }
  });
  return rows;
}

const EVIDENCE_HEADER = "source_preparation,evidence_category,defined_compound_score,context_specific_evidence_score,mechanistic_fit_score,transcriptomic_readiness_score,safety_risk_score,mechanistic_fit_label,safety_risk_label,transcriptomic_readiness_label,canonical_name,drug_class";
const EVIDENCE_ROWS = [
  "Atlas,synthetic demonstration,2,2,1,2,0,supportive,low,direct,Atlas,synthetic",
  "Borealis,synthetic demonstration,2,2,0,2,2,neutral,moderate,direct,Borealis,synthetic",
  "Cygnus,synthetic demonstration,2,2,-1,2,1,opposing,low,direct,Cygnus,synthetic",
  "Draco,synthetic demonstration,0,0,0,1,1,unknown,unknown,limited,Draco,synthetic",
  "Equinox,synthetic demonstration,2,2,1,2,0,supportive,low,direct,Equinox,synthetic",
  "Fenix,synthetic demonstration,1,1,0,1,2,unknown,moderate,limited,Fenix,synthetic",
];

export function demoFixture() {
  return {
    id: "synthetic-paired-qpcr-v1",
    assay: { technology: "qpcr", target_category: "other", target_name: "Synthetic target", analysis_goal: "decrease", host_species: null },
    time_unit: "day",
    timepoints: [
      { term: "T0", time_value: 0, filename: "demo-T0.csv", text: csv(measurementRows("T0")) },
      { term: "T1", time_value: 7, filename: "demo-T1.csv", text: csv(measurementRows("T1")) },
    ],
    evidence_profile: { filename: "demo-tier-evidence.csv", text: `${EVIDENCE_HEADER}\n${EVIDENCE_ROWS.join("\n")}\n` },
  };
}

export function demoFiles({ tiers = false } = {}) {
  const fixture = demoFixture();
  return {
    ...fixture,
    selections: fixture.timepoints.map((item) => ({ term: item.term, timeValue: item.time_value, file: new File([item.text], item.filename, { type: "text/csv" }) })),
    candidateEvidenceFile: tiers ? new File([fixture.evidence_profile.text], fixture.evidence_profile.filename, { type: "text/csv" }) : null,
  };
}

