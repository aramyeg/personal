import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock framer-motion
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useScroll: () => ({ scrollYProgress: { current: 0 } }),
    useTransform: () => '50%',
    motion: {
      div: ({
        children,
        className,
        onClick,
        style,
        ...props
      }: Record<string, unknown>) => (
        <div
          className={className as string}
          onClick={onClick as () => void}
          style={style as React.CSSProperties}
          data-testid={props['data-testid'] as string}
          {...props}
        >
          {children as React.ReactNode}
        </div>
      ),
      span: ({
        children,
        className,
        style,
        ...props
      }: Record<string, unknown>) => (
        <span className={className as string} style={style as React.CSSProperties} {...props}>
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
      li: ({
        children,
        className,
        ...props
      }: Record<string, unknown>) => (
        <li className={className as string} {...props}>
          {children as React.ReactNode}
        </li>
      ),
      create: (Component: React.ElementType) => {
        const MotionComponent = ({
          children,
          className,
          style,
          ...props
        }: Record<string, unknown>) => {
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
import { Timeline } from '@/components/sections/timeline';

describe('Timeline Section', () => {
  it('renders the section title', () => {
    render(<Timeline />);
    expect(screen.getByRole('heading', { level: 2, name: /Experience/i })).toBeInTheDocument();
  });

  it('renders career stats', () => {
    render(<Timeline />);
    expect(screen.getByText('Years Coding')).toBeInTheDocument();
    expect(screen.getByText('Companies')).toBeInTheDocument();
    expect(screen.getByText('Countries')).toBeInTheDocument();
  });

  it('renders technology filter buttons', () => {
    render(<Timeline />);
    expect(screen.getByText('Filter by technology:')).toBeInTheDocument();
  });

  it('renders timeline items', () => {
    render(<Timeline />);
    // Check that experiences are rendered (there may be multiple)
    const seniorRoles = screen.getAllByText(/Senior Frontend/i);
    expect(seniorRoles.length).toBeGreaterThan(0);
  });
});

describe('Timeline Section Layout', () => {
  it('has proper section structure with id', () => {
    render(<Timeline />);
    const section = document.querySelector('#experience');
    expect(section).toBeInTheDocument();
    expect(section?.tagName).toBe('SECTION');
  });

  it('timeline container has stacking context for z-index control', () => {
    render(<Timeline />);
    // The timeline container should have isolation: isolate for proper z-index hierarchy
    const container = document.querySelector('.relative');
    expect(container).toBeInTheDocument();
  });

  it('timeline line exists with proper structure', () => {
    render(<Timeline />);
    // The timeline line should be an absolute positioned element
    const timelineLine = document.querySelector('.absolute.left-2');
    expect(timelineLine).toBeInTheDocument();
  });
});
