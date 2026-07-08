import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock framer-motion to avoid animation complexity in tests
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: ({
        children,
        className,
        onClick,
        whileHover,
        whileTap,
        animate,
        initial,
        whileInView,
        viewport,
        transition,
        style,
        ...props
      }: Record<string, unknown>) => (
        <div
          className={className as string}
          onClick={onClick as () => void}
          data-testid={props['data-testid'] as string}
          {...props}
        >
          {children as React.ReactNode}
        </div>
      ),
      span: ({
        children,
        className,
        ...props
      }: Record<string, unknown>) => (
        <span className={className as string} {...props}>
          {children as React.ReactNode}
        </span>
      ),
      button: ({
        children,
        className,
        onClick,
        ...props
      }: Record<string, unknown>) => (
        <button className={className as string} onClick={onClick as () => void} {...props}>
          {children as React.ReactNode}
        </button>
      ),
      p: ({
        children,
        className,
        ...props
      }: Record<string, unknown>) => (
        <p className={className as string} {...props}>
          {children as React.ReactNode}
        </p>
      ),
      create: (Component: React.ElementType) => {
        // Return a component that renders the correct HTML element
        const MotionComponent = ({
          children,
          className,
          initial,
          whileInView,
          viewport,
          variants,
          style,
          ...props
        }: Record<string, unknown>) => {
          // Use createElement to avoid JSX type issues
          return React.createElement(
            Component as string,
            { className: className as string, style: style as React.CSSProperties, ...props },
            children as React.ReactNode
          );
        };
        MotionComponent.displayName = `Motion${String(Component)}`;
        return MotionComponent;
      },
    },
  };
});

// Import after mocking
import { About } from '@/components/sections/about';

describe('About Section', () => {
  it('renders the section title', () => {
    render(<About />);
    // TextReveal splits text into separate spans, so we need a custom matcher
    const titleElement = screen.getByRole('heading', { level: 2 });
    expect(titleElement).toBeInTheDocument();
    expect(titleElement.textContent).toContain('About');
    expect(titleElement.textContent).toContain('Me');
  });

  it('renders all highlight cards', () => {
    render(<About />);
    expect(screen.getByText('8 Years')).toBeInTheDocument();
    expect(screen.getByText('Remote')).toBeInTheDocument();
    expect(screen.getByText('Armenia')).toBeInTheDocument();
    expect(screen.getByText('Marketing')).toBeInTheDocument();
  });

  it('expands card on click and shows detail', () => {
    render(<About />);

    // Find the first card by its label
    const card = screen.getByText('8 Years').closest('[data-testid="about-card"]');
    expect(card).toBeInTheDocument();

    // Click to expand
    if (card) {
      fireEvent.click(card);
    }

    // Should show expanded detail
    expect(screen.getByText('From startups to enterprise-scale applications')).toBeInTheDocument();
  });

  it('toggles fun facts on button click', () => {
    render(<About />);

    const toggleButton = screen.getByText('Show fun facts about me');
    fireEvent.click(toggleButton);

    // Should show fun facts
    expect(screen.getByText('Heavy metal fueled coding sessions')).toBeInTheDocument();

    // Click again to hide
    fireEvent.click(screen.getByText('Hide fun facts'));

    // Fun facts should be hidden (in real DOM with AnimatePresence, this would animate out)
  });

  it('renders professional title and bio', () => {
    render(<About />);
    expect(screen.getByText('Senior Frontend Engineer')).toBeInTheDocument();
  });
});

describe('About Section Layout', () => {
  it('has proper section structure with id', () => {
    render(<About />);
    const section = document.querySelector('#about');
    expect(section).toBeInTheDocument();
    expect(section?.tagName).toBe('SECTION');
  });

  it('renders all four highlight cards with test ids', () => {
    render(<About />);
    // Cards should have data-testid for e2e testing
    const cards = document.querySelectorAll('[data-testid="about-card"]');
    expect(cards.length).toBe(4);
  });
});
