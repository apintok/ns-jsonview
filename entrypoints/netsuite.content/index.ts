import { formatJson, tryParseJson } from '../../utils/json';
import { renderJsonTree } from '../../utils/json-tree';
import {
  diagnoseFields,
  EDIT_MODE,
  FIELD_SELECTOR,
  findFieldContainers,
  getFieldHost,
  isTextareaFieldSpan,
  isViewingJson,
  MASKED_CLASS,
  NETSUITE_MATCHES,
  readFieldValue,
  removePanelIn,
  resolveValueTarget,
  VIEW_MODE,
  type FieldSpan,
  type ValueTarget,
} from '../../utils/netsuite-fields';
import './style.css';

const PROCESSED_ATTR = 'data-ns-jsonview';
const BOUND_ATTR = 'data-ns-jsonview-bound';
const RETRY_MS = 500;
const MAX_RETRIES = 60;

type ViewMode = 'tree' | 'raw';

type PanelOptions = {
  onEditRaw: () => void;
};

declare global {
  interface Window {
    __nsJsonviewDiagnose?: () => ReturnType<typeof diagnoseFields>;
  }
}

function isDebugEnabled(): boolean {
  try {
    return localStorage.getItem('ns-jsonview-debug') === '1';
  } catch {
    return false;
  }
}

function debug(...args: unknown[]): void {
  if (isDebugEnabled()) {
    console.log('[ns-jsonview]', ...args);
  }
}

function markActive(): void {
  const root = document.documentElement;
  root.dataset.nsJsonview = 'active';
  root.dataset.nsJsonviewFrame = window.top === window ? 'top' : 'iframe';
}

function exposeDiagnostics(): void {
  window.__nsJsonviewDiagnose = () => {
    const report = diagnoseFields();
    console.table(report);
    return report;
  };
}

function createPanel(
  target: ValueTarget,
  parsed: unknown,
  options: PanelOptions,
): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'nsjv-panel';

  const header = document.createElement('div');
  header.className = 'nsjv-header';

  const title = document.createElement('span');
  title.className = 'nsjv-title';
  title.textContent = 'JSON View';

  const actions = document.createElement('div');
  actions.className = 'nsjv-actions';

  const treeBtn = document.createElement('button');
  treeBtn.type = 'button';
  treeBtn.className = 'nsjv-btn';
  treeBtn.textContent = 'Tree';

  const rawBtn = document.createElement('button');
  rawBtn.type = 'button';
  rawBtn.className = 'nsjv-btn';
  rawBtn.textContent = 'Formatted';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'nsjv-btn';
  copyBtn.textContent = 'Copy';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'nsjv-btn nsjv-btn-edit';
  editBtn.textContent = 'Edit raw';

  actions.append(treeBtn, rawBtn, copyBtn, editBtn);
  header.append(title, actions);

  const body = document.createElement('div');
  body.className = 'nsjv-body';

  const treeView = renderJsonTree(parsed);
  const rawView = document.createElement('pre');
  rawView.hidden = true;
  rawView.textContent = formatJson(readFieldValue(target)) ?? '';

  body.append(treeView, rawView);
  panel.append(header, body);

  let mode: ViewMode = 'tree';

  const setMode = (next: ViewMode) => {
    mode = next;
    treeView.hidden = mode !== 'tree';
    rawView.hidden = mode !== 'raw';
    treeBtn.disabled = mode === 'tree';
    rawBtn.disabled = mode === 'raw';
  };

  treeBtn.addEventListener('click', () => setMode('tree'));
  rawBtn.addEventListener('click', () => setMode('raw'));
  editBtn.addEventListener('click', options.onEditRaw);

  copyBtn.addEventListener('click', async () => {
    const text = rawView.textContent ?? '';
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = 'Copied';
      window.setTimeout(() => {
        copyBtn.textContent = 'Copy';
      }, 1200);
    } catch {
      copyBtn.textContent = 'Failed';
      window.setTimeout(() => {
        copyBtn.textContent = 'Copy';
      }, 1200);
    }
  });

  setMode('tree');
  return panel;
}

function showJsonView(
  span: FieldSpan,
  target: ValueTarget,
  parsed: unknown,
): void {
  const host = getFieldHost(span);
  removePanelIn(host);
  host.classList.add(MASKED_CLASS);

  const panel = createPanel(target, parsed, {
    onEditRaw: () => showRawField(span, target),
  });

  host.append(panel);
  span.setAttribute(PROCESSED_ATTR, VIEW_MODE);
}

function showRawField(span: FieldSpan, target: ValueTarget): void {
  const host = getFieldHost(span);
  host.classList.remove(MASKED_CLASS);
  removePanelIn(host);
  span.setAttribute(PROCESSED_ATTR, EDIT_MODE);

  const remask = () => {
    const parsed = tryParseJson(readFieldValue(target));
    if (parsed !== null) {
      showJsonView(span, target, parsed);
    }
  };

  if (target instanceof HTMLTextAreaElement) {
    target.addEventListener('blur', remask, { once: true });
    target.focus();
  } else {
    target.addEventListener('blur', remask, { once: true });
  }
}

function enhanceField(span: FieldSpan): boolean {
  if (isViewingJson(span)) return false;

  const target = resolveValueTarget(span);
  const value = readFieldValue(target);
  const parsed = tryParseJson(value);

  if (parsed === null) {
    if (span.getAttribute(PROCESSED_ATTR) === EDIT_MODE) {
      return false;
    }

    debug('No valid JSON in textarea field span', {
      fieldId: span.getAttribute('data-field-id'),
      valueTarget: target.tagName,
      valueLength: value.length,
      preview: value.slice(0, 80),
    });
    return false;
  }

  showJsonView(span, target, parsed);
  debug('Masked field with JSON view', span.getAttribute('data-field-id'));
  bindValueWatchers(span, target);

  return true;
}

function bindValueWatchers(span: FieldSpan, target: ValueTarget): void {
  if (span.hasAttribute(BOUND_ATTR)) return;
  span.setAttribute(BOUND_ATTR, 'true');

  const refresh = () => {
    if (!isViewingJson(span)) return;

    const nextParsed = tryParseJson(readFieldValue(target));
    if (nextParsed === null) {
      showRawField(span, target);
      span.removeAttribute(PROCESSED_ATTR);
      span.removeAttribute(BOUND_ATTR);
      return;
    }

    showJsonView(span, target, nextParsed);
  };

  if (target instanceof HTMLTextAreaElement) {
    target.addEventListener('input', refresh);
    target.addEventListener('change', refresh);
  } else {
    const observer = new MutationObserver(refresh);
    observer.observe(target, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }
}

function scan(root: ParentNode = document): number {
  let enhanced = 0;
  findFieldContainers(root).forEach((span) => {
    if (enhanceField(span)) enhanced += 1;
  });
  return enhanced;
}

function observeDynamicFields(): void {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;

        if (isTextareaFieldSpan(node)) {
          enhanceField(node);
          return;
        }

        if (node.querySelector(FIELD_SELECTOR)) {
          scan(node);
        }
      });
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

function scheduleRetries(): void {
  let attempts = 0;

  const retry = () => {
    attempts += 1;
    const fields = findFieldContainers().length;
    const enhanced = scan();

    debug(`Scan attempt ${attempts}`, { fields, enhanced });

    if (attempts === 1 || attempts === MAX_RETRIES) {
      debug('Field diagnostics', diagnoseFields());
    }

    if (attempts < MAX_RETRIES) {
      window.setTimeout(retry, RETRY_MS);
    }
  };

  window.setTimeout(retry, RETRY_MS);
}

function boot(): void {
  markActive();
  exposeDiagnostics();

  debug('Boot', {
    href: location.href,
    frame: document.documentElement.dataset.nsJsonviewFrame,
    fields: findFieldContainers().length,
    enhanced: scan(),
  });

  observeDynamicFields();
  scheduleRetries();
}

export default defineContentScript({
  matches: [...NETSUITE_MATCHES],
  allFrames: true,
  runAt: 'document_idle',
  main() {
    boot();
  },
});
