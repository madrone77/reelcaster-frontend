'use client';

import { Component, type ReactNode } from 'react';

/**
 * A local error boundary for one client widget.
 *
 * Without a boundary anywhere in the tree, a throw from any client component
 * unwinds to Next's built-in global error page, and that page is far worse
 * than a broken widget: it renders its own `<html><head></head>`, which
 * REPLACES the document head. Title, meta description, canonical and JSON-LD
 * all vanish, and the whole document becomes the string "Application error: a
 * client-side exception has occurred". A crawler that renders the page during
 * one of those moments indexes exactly that, and the search result for the
 * page becomes the error text until the next successful render.
 *
 * That is not hypothetical — it is what happened to the homepage's search
 * snippet. See product-carousel.tsx for the widget that caused it.
 *
 * So anything that can throw for reasons outside our control (a GPU that goes
 * away, a third party, a browser API that is present but refuses to work) gets
 * wrapped in one of these, and degrades to a fallback in its own slot while
 * the page around it — and the head above it — stays intact.
 */
export default class ClientErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; label?: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    // Left visible in the console on purpose: the fallback is deliberately
    // quiet on screen, so this is the only trace that it engaged.
    console.error(
      `[${this.props.label ?? 'ClientErrorBoundary'}] rendering fallback:`,
      error,
    );
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
