import { formatJson, tryParseJson } from '../../utils/json';
import { renderJsonTree } from '../../utils/json-tree';
import {
  diagnoseFields,
  FIELD_SELECTOR,
  findFieldContainers,
  getFieldHost,
  isJsonViewDisabled,
  isTextareaFieldSpan,
  isViewingJson,
  MASKED_CLASS,
  NETSUITE_MATCHES,
  RAW_MODE,
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

type PanelOptions = {
  onDisableView: () => void;
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

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'nsjv-btn';
  copyBtn.textContent = 'Copy';

  const disableViewBtn = document.createElement('button');
  disableViewBtn.type = 'button';
  disableViewBtn.className = 'nsjv-btn';
  disableViewBtn.textContent = 'Disable View';

  actions.append(copyBtn, disableViewBtn);
  header.append(title, actions);

  const body = document.createElement('div');
  body.className = 'nsjv-body';
  body.append(renderJsonTree(parsed));
  panel.append(header, body);

  const formattedJson = formatJson(readFieldValue(target)) ?? '';

  disableViewBtn.addEventListener('click', options.onDisableView);

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(formattedJson);
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
    onDisableView: () => disableJsonView(span),
  });

  host.append(panel);
  span.setAttribute(PROCESSED_ATTR, VIEW_MODE);
}

function disableJsonView(span: FieldSpan): void {
  const host = getFieldHost(span);
  host.classList.remove(MASKED_CLASS);
  removePanelIn(host);
  span.setAttribute(PROCESSED_ATTR, RAW_MODE);
}

function enhanceField(span: FieldSpan): boolean {
  if (isViewingJson(span) || isJsonViewDisabled(span)) return false;

  const target = resolveValueTarget(span);
  const value = readFieldValue(target);
  const parsed = tryParseJson(value);

  if (parsed === null) {
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
      disableJsonView(span);
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
