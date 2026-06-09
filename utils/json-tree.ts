type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

function createToggle(collapsed: boolean): HTMLSpanElement {
  const toggle = document.createElement('span');
  toggle.className = 'nsjv-toggle';
  toggle.textContent = collapsed ? '▶' : '▼';
  toggle.setAttribute('aria-hidden', 'true');
  return toggle;
}

function renderPrimitive(value: JsonValue): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'nsjv-primitive';

  if (value === null) {
    span.classList.add('nsjv-null');
    span.textContent = 'null';
    return span;
  }

  if (typeof value === 'string') {
    span.classList.add('nsjv-string');
    span.textContent = `"${value}"`;
    return span;
  }

  if (typeof value === 'number') {
    span.classList.add('nsjv-number');
    span.textContent = String(value);
    return span;
  }

  span.classList.add('nsjv-boolean');
  span.textContent = String(value);
  return span;
}

function renderCollection(
  label: string,
  entries: Array<[string, JsonValue]>,
  bracketOpen: string,
  bracketClose: string,
  depth: number,
): HTMLDivElement {
  const block = document.createElement('div');
  block.className = 'nsjv-block';

  const line = document.createElement('div');
  line.className = 'nsjv-line';

  let collapsed = depth > 1;
  const toggle = createToggle(collapsed);
  const opener = document.createElement('span');
  opener.className = 'nsjv-bracket';
  opener.textContent = bracketOpen;

  const summary = document.createElement('span');
  summary.className = 'nsjv-summary';
  summary.textContent = collapsed ? `${label}${bracketClose}` : label;

  line.append(toggle, opener, summary);
  block.append(line);

  const children = document.createElement('div');
  children.className = 'nsjv-children';
  children.hidden = collapsed;

  entries.forEach(([key, value], index) => {
    const row = document.createElement('div');
    row.className = 'nsjv-line';

    const keySpan = document.createElement('span');
    keySpan.className = 'nsjv-key';
    keySpan.textContent = `"${key}": `;
    row.append(keySpan);
    row.append(renderNode(value, depth + 1));

    if (index < entries.length - 1) {
      const comma = document.createElement('span');
      comma.className = 'nsjv-comma';
      comma.textContent = ',';
      row.append(comma);
    }

    children.append(row);
  });

  const closeLine = document.createElement('div');
  closeLine.className = 'nsjv-line';
  const closeBracket = document.createElement('span');
  closeBracket.className = 'nsjv-bracket';
  closeBracket.textContent = bracketClose;
  closeLine.append(closeBracket);
  children.append(closeLine);

  block.append(children);

  const setCollapsed = (next: boolean) => {
    collapsed = next;
    toggle.textContent = collapsed ? '▶' : '▼';
    children.hidden = collapsed;
    summary.textContent = collapsed
      ? `${label}${bracketClose}`
      : label;
  };

  toggle.addEventListener('click', () => setCollapsed(!collapsed));
  line.addEventListener('click', (event) => {
    if (event.target === toggle) return;
    setCollapsed(!collapsed);
  });

  return block;
}

function renderArray(values: JsonArray, depth: number): HTMLElement {
  if (values.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'nsjv-bracket';
    empty.textContent = '[]';
    return empty;
  }

  const block = document.createElement('div');
  block.className = 'nsjv-block';

  const line = document.createElement('div');
  line.className = 'nsjv-line';

  let collapsed = depth > 1;
  const toggle = createToggle(collapsed);
  const opener = document.createElement('span');
  opener.className = 'nsjv-bracket';
  opener.textContent = '[';

  const summary = document.createElement('span');
  summary.className = 'nsjv-summary';
  summary.textContent = collapsed ? `[${values.length}]` : '[';

  line.append(toggle, opener, summary);
  block.append(line);

  const children = document.createElement('div');
  children.className = 'nsjv-children';
  children.hidden = collapsed;

  values.forEach((value, index) => {
    const row = document.createElement('div');
    row.className = 'nsjv-line';
    row.append(renderNode(value, depth + 1));

    if (index < values.length - 1) {
      const comma = document.createElement('span');
      comma.className = 'nsjv-comma';
      comma.textContent = ',';
      row.append(comma);
    }

    children.append(row);
  });

  const closeLine = document.createElement('div');
  closeLine.className = 'nsjv-line';
  const closeBracket = document.createElement('span');
  closeBracket.className = 'nsjv-bracket';
  closeBracket.textContent = ']';
  closeLine.append(closeBracket);
  children.append(closeLine);

  block.append(children);

  const setCollapsed = (next: boolean) => {
    collapsed = next;
    toggle.textContent = collapsed ? '▶' : '▼';
    children.hidden = collapsed;
    summary.textContent = collapsed ? `[${values.length}]` : '[';
  };

  toggle.addEventListener('click', () => setCollapsed(!collapsed));
  line.addEventListener('click', (event) => {
    if (event.target === toggle) return;
    setCollapsed(!collapsed);
  });

  return block;
}

function renderNode(value: JsonValue, depth = 0): HTMLElement {
  if (Array.isArray(value)) return renderArray(value, depth);

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'nsjv-bracket';
      empty.textContent = '{}';
      return empty;
    }

    return renderCollection('', entries, '{', '}', depth);
  }

  return renderPrimitive(value);
}

export function renderJsonTree(root: unknown): HTMLElement {
  const container = document.createElement('div');
  container.className = 'nsjv-tree';

  if (Array.isArray(root)) {
    container.append(renderArray(root, 0));
    return container;
  }

  if (root !== null && typeof root === 'object') {
    const entries = Object.entries(root as JsonObject);
    container.append(renderCollection('', entries, '{', '}', 0));
    return container;
  }

  container.append(renderPrimitive(root as JsonValue));
  return container;
}
