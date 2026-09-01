'use client';

import { useCallback, useRef, useState } from 'react';

import { Input } from '../shadcn/input';
import { Textarea } from '../shadcn/textarea';

function useSpotlight() {
  'use no memo';
  const overlayRef = useRef<HTMLElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!overlayRef.current || isFocused) return;
      const rect = overlayRef.current.getBoundingClientRect();
      setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    },
    [isFocused],
  );

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    setOpacity(1);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    setOpacity(0);
  }, []);

  const handleMouseEnter = useCallback(() => setOpacity(1), []);

  const handleMouseLeave = useCallback(() => {
    if (!isFocused) setOpacity(0);
  }, [isFocused]);

  const overlayStyle: React.CSSProperties = {
    boxShadow: 'inset 0 0 0 2px var(--primary)',
    opacity,
    WebkitMaskImage: `radial-gradient(50% 50px at ${position.x}px ${position.y}px, black 45%, transparent)`,
    maskImage: `radial-gradient(50% 50px at ${position.x}px ${position.y}px, black 45%, transparent)`,
  };

  return {
    overlayRef,
    handleMouseMove,
    handleFocus,
    handleBlur,
    handleMouseEnter,
    handleMouseLeave,
    overlayStyle,
  };
}

export function SpotlightInput({
  className,
  onFocus,
  onBlur,
  ...props
}: React.ComponentPropsWithRef<'input'>) {
  'use no memo';
  const spotlight = useSpotlight();

  return (
    <div className="relative w-full">
      <Input
        onMouseMove={spotlight.handleMouseMove}
        onFocus={(e) => {
          spotlight.handleFocus();
          onFocus?.(e);
        }}
        onBlur={(e) => {
          spotlight.handleBlur();
          onBlur?.(e);
        }}
        onMouseEnter={spotlight.handleMouseEnter}
        onMouseLeave={spotlight.handleMouseLeave}
        className={className}
        {...props}
      />
      <input
        ref={spotlight.overlayRef as React.RefObject<HTMLInputElement>}
        disabled
        aria-hidden="true"
        tabIndex={-1}
        // eslint-disable-next-line react-hooks/refs -- style derived from state, not direct ref reads
        style={spotlight.overlayStyle}
        className="pointer-events-none absolute top-0 left-0 z-10 h-full w-full rounded-md bg-transparent transition-opacity duration-500"
      />
    </div>
  );
}

export function SpotlightTextarea({
  className,
  onFocus,
  onBlur,
  ...props
}: React.ComponentPropsWithRef<'textarea'>) {
  'use no memo';
  const spotlight = useSpotlight();

  return (
    <div className="relative w-full">
      <Textarea
        onMouseMove={spotlight.handleMouseMove}
        onFocus={(e) => {
          spotlight.handleFocus();
          onFocus?.(e);
        }}
        onBlur={(e) => {
          spotlight.handleBlur();
          onBlur?.(e);
        }}
        onMouseEnter={spotlight.handleMouseEnter}
        onMouseLeave={spotlight.handleMouseLeave}
        className={className}
        {...props}
      />
      <div
        ref={spotlight.overlayRef as React.RefObject<HTMLDivElement>}
        aria-hidden="true"
        // eslint-disable-next-line react-hooks/refs -- style derived from state, not direct ref reads
        style={spotlight.overlayStyle}
        className="pointer-events-none absolute top-0 left-0 z-10 h-full w-full rounded-md bg-transparent transition-opacity duration-500"
      />
    </div>
  );
}
