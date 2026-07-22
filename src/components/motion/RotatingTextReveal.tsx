import { useEffect, useRef, useState, type ElementType } from 'react'
import gsap from 'gsap'
import { BlurTextReveal } from './BlurTextReveal'

type RotatingTextRevealProps = {
  texts: string[]
  prefix?: string
  suffix?: string
  as?: ElementType
  className?: string
  interval?: number
  stagger?: number
  delay?: number
  active?: boolean
}

export function RotatingTextReveal({
  texts,
  prefix,
  suffix,
  as: Tag = 'span',
  className,
  interval = 3000,
  stagger = 0.08,
  delay = 0,
  active = true,
}: RotatingTextRevealProps) {
  const [index, setIndex] = useState(0)
  const wordHostRef = useRef<HTMLSpanElement>(null)
  const timeoutRef = useRef<number | null>(null)
  const exitTweenRef = useRef<gsap.core.Tween | null>(null)
  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const currentText = texts[index] ?? ''

  const clearCycle = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    exitTweenRef.current?.kill()
    exitTweenRef.current = null
  }

  const animateToNextWord = () => {
    const chars = wordHostRef.current?.querySelectorAll<HTMLElement>('.blur-text-reveal__char')
    if (!chars?.length) return

    exitTweenRef.current = gsap.to(chars, {
      autoAlpha: 0,
      filter: 'blur(12px)',
      y: -10,
      duration: 0.45,
      stagger: { each: stagger, from: 'random' },
      ease: 'power2.in',
      onComplete: () => {
        exitTweenRef.current = null
        setIndex((current) => (current + 1) % texts.length)
      },
    })
  }

  const scheduleNextWord = () => {
    clearCycle()
    if (!active || reducedMotion || texts.length <= 1) return
    timeoutRef.current = window.setTimeout(animateToNextWord, interval)
  }

  useEffect(() => {
    if (!active) clearCycle()
    return clearCycle
  }, [active])

  if (!texts.length) return null

  return (
    <Tag className={className}>
      {prefix && (
        <BlurTextReveal
          as="span"
          text={prefix}
          animationType="chars"
          stagger={stagger}
          delay={delay}
          active={active}
        />
      )}
      {prefix && ' '}
      <span ref={wordHostRef} className="rotating-text-reveal__word">
        <BlurTextReveal
          key={`${index}-${currentText}`}
          as="span"
          text={currentText}
          animationType="chars"
          stagger={stagger}
          delay={index === 0 ? delay : 0}
          active={active}
          onCompleteAnimation={scheduleNextWord}
        />
      </span>
      {suffix && ` ${suffix}`}
    </Tag>
  )
}
