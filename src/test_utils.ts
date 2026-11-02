/**
 * Утилиты для поведенческого тестирования React-компонентов и хуков в Node.js / JSDOM.
 */
import { win } from './test_setup_dom';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';

let currentRoot: Root | null = null;
let currentContainer: HTMLElement = win.document.getElementById('root') as HTMLElement;

export function setupTestEnvironment(): void {
  win.document.body.innerHTML = '<div id="root"></div>';
  currentContainer = win.document.getElementById('root') as HTMLElement;
  win.localStorage.clear();
}

export function cleanupTestEnvironment(): void {
  if (currentRoot) {
    try {
      React.act(() => {
        currentRoot?.unmount();
      });
    } catch {}
    currentRoot = null;
  }
  win.document.body.innerHTML = '<div id="root"></div>';
  currentContainer = win.document.getElementById('root') as HTMLElement;
  win.localStorage.clear();
}

export interface RenderResult {
  container: HTMLElement;
  unmount: () => void;
  getByText: (matcher: string | RegExp) => HTMLElement;
  queryByText: (matcher: string | RegExp) => HTMLElement | null;
  getByRole: (role: string, name?: string | RegExp) => HTMLElement;
  querySelector: <T extends Element = HTMLElement>(selector: string) => T | null;
  querySelectorAll: <T extends Element = HTMLElement>(selector: string) => T[];
}

export function render(ui: React.ReactElement): RenderResult {
  if (currentRoot) {
    try {
      React.act(() => {
        currentRoot?.unmount();
      });
    } catch {}
    currentRoot = null;
  }
  setupTestEnvironment();

  currentContainer.innerHTML = '';
  const root = createRoot(currentContainer);
  currentRoot = root;

  React.act(() => {
    root.render(ui);
  });

  const queryByText = (matcher: string | RegExp): HTMLElement | null => {
    // Ищем как внутри контейнера, так и в document.body (для порталов модальных окон)
    const all = win.document.body.querySelectorAll('*');
    for (const el of Array.from(all)) {
      const text = el.textContent || '';
      if (typeof matcher === 'string' ? text.includes(matcher) : matcher.test(text)) {
        // Проверяем, есть ли более глубокий потомок с тем же совпадением
        let hasDeeper = false;
        for (const child of Array.from(el.children)) {
          const childText = child.textContent || '';
          if (typeof matcher === 'string' ? childText.includes(matcher) : matcher.test(childText)) {
            hasDeeper = true;
            break;
          }
        }
        if (!hasDeeper) return el as HTMLElement;
      }
    }
    return null;
  };

  const getByText = (matcher: string | RegExp): HTMLElement => {
    const el = queryByText(matcher);
    if (!el) {
      throw new Error(
        `Element with text matching "${matcher}" not found in body: ${win.document.body.innerHTML.slice(0, 400)}...`
      );
    }
    return el;
  };

  const getByRole = (role: string, name?: string | RegExp): HTMLElement => {
    let selector = role;
    if (role === 'button') selector = 'button, [role="button"], input[type="button"], input[type="submit"]';
    if (role === 'textbox') selector = 'input[type="text"], input:not([type]), textarea';

    const candidates = Array.from(win.document.body.querySelectorAll(selector)) as HTMLElement[];
    if (name) {
      const match = candidates.find((el) => {
        const text = el.textContent || el.getAttribute('aria-label') || el.getAttribute('value') || '';
        return typeof name === 'string' ? text.includes(name) : name.test(text);
      });
      if (match) return match;
    } else if (candidates.length > 0) {
      return candidates[0];
    }
    throw new Error(`Role "${role}" ${name ? `with name "${name}"` : ''} not found`);
  };

  const querySelector = <T extends Element = HTMLElement>(selector: string): T | null => {
    return (currentContainer.querySelector<T>(selector) || win.document.body.querySelector<T>(selector));
  };

  const querySelectorAll = <T extends Element = HTMLElement>(selector: string): T[] => {
    return Array.from(win.document.body.querySelectorAll<T>(selector));
  };

  return {
    container: currentContainer,
    unmount: () => {
      React.act(() => {
        root.unmount();
      });
    },
    getByText,
    queryByText,
    getByRole,
    querySelector,
    querySelectorAll,
  };
}

export const fireEvent = {
  click: (element: Element) => {
    React.act(() => {
      element.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  },

  change: (element: Element, value: string) => {
    React.act(() => {
      const tracker = (element as unknown as { _valueTracker?: { setValue: (v: string) => void } })._valueTracker;
      if (tracker) {
        tracker.setValue(value + '_diff');
      }
      if (element instanceof win.HTMLInputElement) {
        const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(element, value);
        else (element as HTMLInputElement).value = value;
      } else if (element instanceof win.HTMLTextAreaElement) {
        const setter = Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, 'value')?.set;
        if (setter) setter.call(element, value);
        else (element as HTMLTextAreaElement).value = value;
      } else if (element instanceof win.HTMLSelectElement) {
        const setter = Object.getOwnPropertyDescriptor(win.HTMLSelectElement.prototype, 'value')?.set;
        if (setter) setter.call(element, value);
        else (element as HTMLSelectElement).value = value;
      }
      element.dispatchEvent(new win.Event('input', { bubbles: true }));
      element.dispatchEvent(new win.Event('change', { bubbles: true }));
    });
  },

  submit: (element: Element) => {
    React.act(() => {
      element.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
    });
  },
};

export async function waitFor(
  assertion: () => void | boolean,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 1000, interval = 20 } = options;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    try {
      const res = assertion();
      if (res !== false) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  // Final call that throws if it fails
  assertion();
}

export const act = React.act;
