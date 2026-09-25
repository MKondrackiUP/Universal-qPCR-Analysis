import { renderGenericAssessmentDocx } from "./lib/docx.mjs";
import { buildGenericAssessmentReportModel } from "./lib/generic-report-model.mjs";

const DOCX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
let objectUrls = [];

function objectUrl(content, mediaType) {
  const url = URL.createObjectURL(new Blob([content], { type: mediaType }));
  objectUrls.push(url);
  return url;
}

export function releaseLocalReportDownloads() {
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls = [];
}

export function buildLocalAssessmentReport(result, language) {
  releaseLocalReportDownloads();
  const report = buildGenericAssessmentReportModel(result, {
    language,
    source: "browser_local_analysis_and_report",
  });
  const docx = renderGenericAssessmentDocx(report);
  const json = new TextEncoder().encode(`${JSON.stringify(report, null, 2)}\n`);
  const suffix = report.language === "en" ? "en" : "pl";
  report.downloads = {
    docx: objectUrl(docx, DOCX_MEDIA_TYPE),
    json: objectUrl(json, "application/json;charset=utf-8"),
  };
  report.download_filenames = {
    docx: `universal-qpcr-report-${suffix}.docx`,
    json: `universal-qpcr-report-${suffix}.json`,
  };
  report.local_execution = {
    mode: "browser_memory_only",
    workbook_upload_performed: false,
    server_run_created: false,
    server_storage_used: false,
    docx_generated_locally: true,
  };
  return report;
}

export function downloadLocalDocx(report) {
  const anchor = document.createElement("a");
  anchor.href = report.downloads.docx;
  anchor.download = report.download_filenames.docx;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

