import { tryParseJson } from './json';

export const NETSUITE_MATCHES = [
  '*://*.netsuite.com/*',
  '*://*.app.netsuite.com/*',
] as const;

/** NetSuite marks textarea fields with a span inside a div. */
export const FIELD_SELECTOR = 'div span[data-field-type="textarea"]';

export const MASKED_CLASS = 'nsjv-masked';
export const VIEW_MODE = 'view';
export const EDIT_MODE = 'edit';

export type FieldSpan = HTMLSpanElement;
export type ValueTarget = HTMLSpanElement | HTMLTextAreaElement;

export function isTextareaFieldSpan(element: Element): element is FieldSpan {
  return (
    element instanceof HTMLSpanElement &&
    element.getAttribute('data-field-type') === 'textarea' &&
    element.closest('div') !== null
  );
}

export function findFieldContainers(root: ParentNode = document): FieldSpan[] {
  return [...root.querySelectorAll(FIELD_SELECTOR)].filter(isTextareaFieldSpan);
}

export function getFieldDiv(span: FieldSpan): HTMLDivElement | null {
  const div = span.closest('div');
  return div instanceof HTMLDivElement ? div : null;
}

export function resolveValueTarget(span: FieldSpan): ValueTarget {
  const textarea = getFieldDiv(span)?.querySelector('textarea');
  if (textarea instanceof HTMLTextAreaElement) return textarea;
  return span;
}

export function readFieldValue(target: ValueTarget): string {
  if (target instanceof HTMLTextAreaElement) {
    return target.value ?? target.textContent ?? '';
  }

  return target.textContent?.trim() ?? '';
}

export function getFieldHost(span: FieldSpan): HTMLDivElement | FieldSpan {
  return getFieldDiv(span) ?? span;
}

export function removePanelIn(host: Element): void {
  host.querySelector('.nsjv-panel')?.remove();
}

export function isViewingJson(span: FieldSpan): boolean {
  return span.getAttribute('data-ns-jsonview') === VIEW_MODE;
}

export type FieldDiagnostic = {
  fieldType: string | null;
  fieldId: string | null;
  tag: string;
  parentDiv: boolean;
  valueTarget: string | null;
  valueLength: number;
  valuePreview: string;
  isValidJson: boolean;
};

export function diagnoseFields(root: ParentNode = document): FieldDiagnostic[] {
  return findFieldContainers(root).map((span) => {
    const target = resolveValueTarget(span);
    const value = readFieldValue(target);

    return {
      fieldType: span.getAttribute('data-field-type'),
      fieldId: span.getAttribute('data-field-id'),
      tag: span.tagName,
      parentDiv: getFieldDiv(span) !== null,
      valueTarget: target.tagName,
      valueLength: value.length,
      valuePreview: value.slice(0, 120),
      isValidJson: tryParseJson(value) !== null,
    };
  });
}
