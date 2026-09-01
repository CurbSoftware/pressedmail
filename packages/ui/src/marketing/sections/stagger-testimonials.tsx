'use client';

import React, { useCallback, useEffect, useState } from 'react';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '#utils';

const SQRT_5000 = Math.sqrt(5000);

export interface StaggerTestimonial {
  id: number;
  quote: string;
  name: string;
  role: string;
  initials: string;
}

export interface StaggerTestimonialsProps {
  testimonials: StaggerTestimonial[];
  className?: string;
}

function buildCardClipPath(size: number): string {
  const r = 12; // matches rounded-xl
  const cut = 50; // top-right diagonal cut
  const W = size;
  const H = size;

  return `path('M ${r} 0 L ${W - cut} 0 L ${W} ${cut} L ${W} ${H - r} A ${r} ${r} 0 0 1 ${W - r} ${H} L ${r} ${H} A ${r} ${r} 0 0 1 0 ${H - r} L 0 ${r} A ${r} ${r} 0 0 1 ${r} 0 Z')`;
}

interface TestimonialCardProps {
  position: number;
  testimonial: StaggerTestimonial & { tempId: number };
  handleMove: (steps: number) => void;
  cardSize: number;
}

function TestimonialCard({
  position,
  testimonial,
  handleMove,
  cardSize,
}: TestimonialCardProps) {
  const isCenter = position === 0;

  return (
    <div
      onClick={() => handleMove(position)}
      className={cn(
        'absolute top-1/2 left-1/2 cursor-pointer rounded-xl border-2 p-8 drop-shadow-md transition-all duration-500 ease-in-out',
        isCenter
          ? 'bg-primary text-primary-foreground border-primary z-10 drop-shadow-xl'
          : 'bg-card text-card-foreground border-border z-0',
      )}
      style={{
        width: cardSize,
        height: cardSize,
        clipPath: buildCardClipPath(cardSize),
        transform: `
          translate(-50%, -50%)
          translateX(${(cardSize / 1.5) * position}px)
          translateY(${isCenter ? -65 : position % 2 ? 15 : -15}px)
          rotate(${isCenter ? 0 : position % 2 ? 2.5 : -2.5}deg)
        `,
        boxShadow: isCenter
          ? '0px 8px 0px 4px hsl(var(--border))'
          : '0px 0px 0px 0px transparent',
      }}
    >
      {/* Diagonal corner line */}
      <span
        className={cn(
          'absolute block origin-top-right rotate-45',
          isCenter ? 'bg-primary-foreground/20' : 'bg-border',
        )}
        style={{
          right: -2,
          top: 48,
          width: SQRT_5000,
          height: 2,
        }}
      />

      {/* Avatar initials */}
      <div
        className={cn(
          'mb-4 flex h-14 w-12 items-center justify-center text-sm font-bold',
          isCenter
            ? 'bg-primary-foreground/20 text-primary-foreground'
            : 'bg-primary/10 text-primary',
        )}
        style={{
          boxShadow: '3px 3px 0px hsl(var(--background))',
        }}
      >
        {testimonial.initials}
      </div>

      {/* Quote */}
      <h3
        className={cn(
          'text-base font-medium sm:text-xl',
          isCenter ? 'text-primary-foreground' : 'text-foreground/90',
        )}
      >
        &quot;{testimonial.quote}&quot;
      </h3>

      {/* Attribution */}
      <p
        className={cn(
          'absolute right-8 bottom-8 left-8 mt-2 text-sm italic',
          isCenter ? 'text-primary-foreground/80' : 'text-muted-foreground/80',
        )}
      >
        - {testimonial.name}, {testimonial.role}
      </p>
    </div>
  );
}

export function StaggerTestimonials({
  testimonials,
  className,
}: StaggerTestimonialsProps) {
  const t = useTranslations('marketing');
  const [cardSize, setCardSize] = useState(365);
  const [testimonialsList, setTestimonialsList] = useState(
    testimonials.map((item) => ({ ...item, tempId: item.id })),
  );

  const handleMove = useCallback(
    (steps: number) => {
      const newList = [...testimonialsList];

      if (steps > 0) {
        for (let i = steps; i > 0; i--) {
          const item = newList.shift();
          if (!item) return;
          newList.push({ ...item, tempId: Math.random() });
        }
      } else {
        for (let i = steps; i < 0; i++) {
          const item = newList.pop();
          if (!item) return;
          newList.unshift({ ...item, tempId: Math.random() });
        }
      }

      setTestimonialsList(newList);
    },
    [testimonialsList],
  );

  useEffect(() => {
    const updateSize = () => {
      const { matches } = window.matchMedia('(min-width: 640px)');
      setCardSize(matches ? 365 : 290);
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  return (
    <section className={cn('py-20 md:py-28 lg:py-36', className)}>
      <div className="container">
        <div className="mx-auto max-w-6xl">
          {/* Section heading */}
          <div className="mb-10 md:mb-16">
            <h2 className="font-heading text-foreground text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              {t('testimonials.heading')}
            </h2>
            <p className="text-muted-foreground mt-3 text-base leading-relaxed md:text-lg">
              {t('testimonials.description')}
            </p>
          </div>
        </div>
      </div>

      {/* Carousel area (full width, overflow hidden) */}
      <div className="relative w-full overflow-hidden" style={{ height: 600 }}>
        {testimonialsList.map((testimonial, index) => {
          const position =
            testimonialsList.length % 2
              ? index - (testimonialsList.length + 1) / 2
              : index - testimonialsList.length / 2;

          return (
            <TestimonialCard
              key={testimonial.tempId}
              testimonial={testimonial}
              handleMove={handleMove}
              position={position}
              cardSize={cardSize}
            />
          );
        })}

        {/* Navigation buttons */}
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
          <button
            onClick={() => handleMove(-1)}
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-full text-2xl transition-colors',
              'bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground',
              'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
            )}
            aria-label="Previous testimonial"
          >
            <ChevronLeft />
          </button>
          <button
            onClick={() => handleMove(1)}
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-full text-2xl transition-colors',
              'bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground',
              'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
            )}
            aria-label="Next testimonial"
          >
            <ChevronRight />
          </button>
        </div>
      </div>
    </section>
  );
}
