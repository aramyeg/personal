import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock framer-motion
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
        ...props
      }: Record<string, unknown>) => (
        <span className={className as string} {...props}>
          {children as React.ReactNode}
        </span>
      ),
      h2: ({
        children,
        className,
        ...props
      }: Record<string, unknown>) => (
        <h2 className={className as string} {...props}>
          {children as React.ReactNode}
        </h2>
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
      a: ({
        children,
        className,
        href,
        ...props
      }: Record<string, unknown>) => (
        <a className={className as string} href={href as string} {...props}>
          {children as React.ReactNode}
        </a>
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
import { Contact } from '@/components/sections/contact';

describe('Contact Section', () => {
  it('renders the section heading', () => {
    render(<Contact />);
    // Check for the main heading text
    expect(screen.getByText("Let's Create Some")).toBeInTheDocument();
  });

  it('renders email button', () => {
    render(<Contact />);
    // The email link is a native <a> element
    const emailLink = document.querySelector('a[href^="mailto:"]');
    expect(emailLink).toBeInTheDocument();
    // Check that the href starts with mailto:
    expect(emailLink?.getAttribute('href')).toMatch(/^mailto:/);
  });

  it('renders location info', () => {
    render(<Contact />);
    expect(screen.getByText(/Yerevan, Armenia/i)).toBeInTheDocument();
  });

  it('renders social links', () => {
    render(<Contact />);
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('LinkedIn')).toBeInTheDocument();
  });
});

describe('Contact Section Layout', () => {
  it('has proper section structure with id', () => {
    render(<Contact />);
    const section = document.querySelector('#contact');
    expect(section).toBeInTheDocument();
    expect(section?.tagName).toBe('SECTION');
  });

  it('email link exists with proper structure', () => {
    render(<Contact />);
    // The email link should exist with mailto href
    const emailLink = document.querySelector('a[href^="mailto:"]');
    expect(emailLink).toBeInTheDocument();
    // Link should be a block-level element for stable hover area
    expect(emailLink).toHaveClass('inline-flex');
  });
});

describe('Contact Section Interactions', () => {
  it('rock on card increments click counter', () => {
    render(<Contact />);
    // Find the clickable card (the motion.div parent of the "Rock On!" heading)
    const rockHeading = screen.getByText('Rock On!');
    // The clickable card is 3 parents up (h3 -> inner div -> motion.div)
    const rockCard = rockHeading.closest('.cursor-pointer');
    expect(rockCard).toBeInTheDocument();

    if (rockCard) {
      // Initial state
      expect(screen.getByText(/Clicked 0 times/i)).toBeInTheDocument();

      fireEvent.click(rockCard);
      expect(screen.getByText(/Clicked 1 time(?!s)/)).toBeInTheDocument();

      fireEvent.click(rockCard);
      expect(screen.getByText(/Clicked 2 times/i)).toBeInTheDocument();
    }
  });
});
