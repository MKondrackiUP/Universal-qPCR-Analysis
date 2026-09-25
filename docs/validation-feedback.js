/** Translate a validation or workflow error without coupling it to the DOM. */
export function localizedErrorMessage(error, translate) {
  if (error?.code) {
    return translate(`error.validation.${error.code}`, {}, error.message);
  }
  return error?.message ?? translate("run.failed");
}

function detailItems(error, translate) {
  const details = error?.details ?? {};
  const items = [];

  if (details.missing?.length) {
    const fields = details.missing
      .map((item) => translate(`input.field.${item.field}`, {}, item.field))
      .join(", ");
    items.push(translate("error.detail.missingColumns", { fields }));
  }
  if (details.matching_headers?.length) {
    items.push(translate("error.detail.ambiguousHeaders", { headers: details.matching_headers.join(", ") }));
  }
  if (details.detectors?.length) {
    items.push(translate("error.detail.detectors", { values: details.detectors.join(", ") }));
  }
  if (details.invalid_tasks?.length) {
    items.push(translate("error.detail.tasks", { values: details.invalid_tasks.join(", ") }));
  }

  for (const issue of details.issues ?? []) {
    const fields = issue.missing_fields
      ?.map((field) => translate(`input.field.${field}`, {}, field))
      .join(", ")
      ?? translate(`input.field.${issue.field}`, {}, issue.field);
    const value = issue.value == null
      ? ""
      : ` · ${translate("error.detail.value", { value: issue.value })}`;
    items.push(`${translate("error.detail.row", { row: issue.row, fields })}${value}`);
  }
  return items;
}

/** Build a presentation-neutral description consumed by the browser error panel. */
export function validationErrorViewModel(error, translate) {
  const details = error?.details ?? {};
  return {
    titleKey: error?.code ? "error.validationTitle" : "error.formTitle",
    code: error?.code ?? null,
    message: localizedErrorMessage(error, translate),
    context: [details.term, details.filename].filter(Boolean).join(" · "),
    items: detailItems(error, translate),
    hint: error?.code ? translate(`error.hint.${error.code}`, {}, "") : "",
    term: details.term ?? null,
  };
}
