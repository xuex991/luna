import { createElement, useLayoutEffect, useRef, type ElementType } from 'react'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(SplitText)

type AnimationType = 'chars' | 'words' | 'lines'

type BlurTextRevealProps = {
  text: string
  as?: ElementType
  className?: string
  animationType?: AnimationType
  stagger?: number
  delay?: number
  active?: boolean
  onCompleteAnimation?: () => void
}

/** Reveals accessible text with a SplitText-driven blur animation. */
export function BlurTextReveal({
  text,
  as = 'span',
  className,
  animationType = 'chars',
  stagger = 0.045,
  delay = 0,
  active = true,
  onCompleteAnimation,
}: BlurTextRevealProps) {
  const textRef = useRef<HTMLElement>(null)
  const onCompleteRef = useRef(onCompleteAnimation)
  onCompleteRef.current = onCompleteAnimation

  useLayoutEffect(() => {
    const element = textRef.current
    if (!element || !active) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const split = new SplitText(element, {
      type: 'chars,words,lines',
      smartWrap: true,
      tag: 'span',
      aria: 'auto',
      charsClass: 'blur-text-reveal__char',
      wordsClass: 'blur-text-reveal__word',
      linesClass: 'blur-text-reveal__line',
    })
    const targets = animationType === 'chars'
      ? split.chars
      : animationType === 'words'
        ? split.words
        : split.lines

    const context = gsap.context(() => {
      if (reducedMotion) {
        gsap.set([element, ...targets], {
          clearProps: 'filter,opacity,transform,visibility,willChange',
        })
        onCompleteRef.current?.()
        return
      }

      gsap.set(element, {
        autoAlpha: 0,
        filter: 'blur(12px)',
        willChange: 'filter,opacity',
      })
      gsap.set(targets, {
        autoAlpha: 0,
        filter: 'blur(12px)',
        y: 14,
        willChange: 'filter,opacity,transform',
      })

      gsap.timeline({ onComplete: () => onCompleteRef.current?.() })
        .to(element, {
          autoAlpha: 1,
          filter: 'blur(0px)',
          duration: 0.5,
          delay,
          ease: 'power2.out',
        })
        .to(targets, {
          autoAlpha: 1,
          filter: 'blur(0px)',
          y: 0,
          duration: 0.8,
          stagger: { each: stagger, from: 'random' },
          ease: 'power2.out',
        }, delay)
        .set([element, ...targets], {
          clearProps: 'filter,opacity,transform,visibility,willChange',
        })
    }, element)

    return () => {
      context.revert()
      split.revert()
    }
  }, [active, animationType, delay, stagger, text])

  return createElement(as, {
    ref: textRef,
    className: ['blur-text-reveal', className].filter(Boolean).join(' ') || undefined,
  }, text)
}
