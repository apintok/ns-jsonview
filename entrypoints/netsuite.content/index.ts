import { formatJson, tryParseJson } from '../../utils/json';
import { renderJsonTree } from '../../utils/json-tree';
import './style.css';

const FIELD_SELECTOR = '[data-field-type="textarea"]';
const PROCESSED_ATTR = 'data-ns-jsonview';

type ViewMode = 'tree' | 'raw';

function findTextControl(container: Element): HTMLTextAreaElement | null {
  if (container instanceof HTMLTextAreaElement) return container;

  const textarea = container.querySelector('textarea');
  if (textarea instanceof HTMLTextAreaElement) return textarea;

  return null;
}

function readFieldValue(textarea: HTMLTextAreaElement): string {
  return textarea.value ?? '';
}

function createPanel(textarea: HTMLTextAreaElement, parsed: unknown): HTMLElement {
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

  actions.append(treeBtn, rawBtn, copyBtn);
  header.append(title, actions);

  const body = document.createElement('div');
  body.className = 'nsjv-body';

  const treeView = renderJsonTree(parsed);
  const rawView = document.createElement('pre');
  rawView.hidden = true;
  rawView.textContent = formatJson(readFieldValue(textarea)) ?? '';

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

  copyBtn.addEventListener('click', async () => {
    const text = mode === 'tree' ? rawView.textContent ?? '' : rawView.textContent ?? '';
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

function removePanel(container: Element): void {
  const existing = container.querySelector('.nsjv-panel');
  existing?.remove();
}

function enhanceField(container: Element): void {
  if (container.hasAttribute(PROCESSED_ATTR)) return;

  const textarea = findTextControl(container);
  if (!textarea) return;

  const value = readFieldValue(textarea);
  const parsed = tryParseJson(value);
  if (parsed === null) return;

  container.setAttribute(PROCESSED_ATTR, 'true');
  removePanel(container);

  const panel = createPanel(textarea, parsed);
  textarea.insertAdjacentElement('afterend', panel);

  const refresh = () => {
    const nextValue = readFieldValue(textarea);
    const nextParsed = tryParseJson(nextValue);

    if (nextParsed === null) {
      removePanel(container);
      container.removeAttribute(PROCESSED_ATTR);
      return;
    }

    const nextPanel = createPanel(textarea, nextParsed);
    panel.replaceWith(nextPanel);
  };

  textarea.addEventListener('input', refresh);
  textarea.addEventListener('change', refresh);
}

function scan(root: ParentNode = document): void {
  root.querySelectorAll(FIELD_SELECTOR).forEach((container) => {
    enhanceField(container);
  });
}

function observeDynamicFields(): void {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;

        if (node.matches(FIELD_SELECTOR)) {
          enhanceField(node);
          return;
        }

        if (node.querySelector(FIELD_SELECTOR)) {
          scan(node);
        }
      });
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

export default defineContentScript({
  matches: ['*://*.netsuite.com/*'],
  runAt: 'document_idle',
  main() {
    scan();
    observeDynamicFields();
  },
});
