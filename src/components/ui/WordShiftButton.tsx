import { useLayoutEffect, useRef } from 'react'

type WordShiftButtonProps = {
  text: string
  href: string
  className?: string
}

const STEP = 30
const BASE_DURATION = 300
const DURATION_STEP = 30
const ARROW_RUN = 28

function characters(text: string) {
  return Array.from(text).map((character, index) => (
    <span className="word-shift-button__char" key={`${character}-${index}`}>
      {character === ' ' ? '\u00a0' : character}
    </span>
  ))
}

function ArrowIcon() {
  return (
    <svg width="10" height="9" viewBox="0 0 10 9" fill="none" aria-hidden="true">
      <path
        d="M5.47372 8.652V6.552L8.32972 3.752V4.9L5.47372 2.1V-3.09944e-06L9.32372 3.836V4.816L5.47372 8.652ZM-0.000281237 5.11V3.542H8.60972V5.11H-0.000281237Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** Text-link control with a directional hover transition. */
export function WordShiftButton({ text, href, className = '' }: WordShiftButtonProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const linkRef = useRef<HTMLAnchorElement>(null)
  const wordRef = useRef<HTMLSpanElement>(null)
  const rightArrowRef = useRef<HTMLSpanElement>(null)
  const rightSpriteRef = useRef<HTMLSpanElement>(null)
  const leftSpriteRef = useRef<HTMLSpanElement>(null)
  const rightUnderlineRef = useRef<HTMLSpanElement>(null)
  const leftUnderlineRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    const link = linkRef.current
    const word = wordRef.current
    const rightArrow = rightArrowRef.current
    const chars = Array.from(word?.querySelectorAll<HTMLElement>('.word-shift-button__char') ?? [])
    if (!root || !link || !word || chars.length === 0) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const getDistance = (state: 'in' | 'out') => {
      const buttonRect = link.getBoundingClientRect()
      const wordRect = word.getBoundingClientRect()
      const arrowWidth = rightArrow?.getBoundingClientRect().width ?? 0
      const arrowGap = 10
      const inset = 8
      const distance = state === 'in'
        ? buttonRect.right - wordRect.right + 1
        : buttonRect.right - inset - arrowWidth - arrowGap - wordRect.right

      return Math.max(0, distance)
    }

    const setTextTiming = (state: 'in' | 'out') => {
      const distance = getDistance(state)
      chars.forEach((character, index) => {
        const order = state === 'in' ? chars.length - index - 1 : index
        character.style.setProperty('--group-move', `${distance}px`)
        character.style.setProperty('--delay', `${order * STEP}ms`)
        character.style.setProperty('--dur', `${BASE_DURATION + order * DURATION_STEP}ms`)
      })

      return Math.max(
        120,
        Math.round(((chars.length - 1) * STEP + (BASE_DURATION + (chars.length - 1) * DURATION_STEP)) * 0.5),
      )
    }

    const inDuration = setTextTiming('in')
    setTextTiming('out')

    const rightSprite = rightSpriteRef.current
    const leftSprite = leftSpriteRef.current
    const rightUnderline = rightUnderlineRef.current
    const leftUnderline = leftUnderlineRef.current
    if (!rightSprite || !leftSprite || !rightUnderline || !leftUnderline) return

    rightSprite.style.opacity = '1'
    rightSprite.style.transform = 'translateX(0px)'
    leftSprite.style.opacity = '0'
    leftSprite.style.transform = `translateX(-${ARROW_RUN}px)`
    rightUnderline.style.transformOrigin = 'right center'
    rightUnderline.style.transform = 'scaleX(1)'
    leftUnderline.style.transformOrigin = 'left center'
    leftUnderline.style.transform = 'scaleX(0)'

    let hovered = false

    const getTranslateX = (element: HTMLElement) => {
      const transform = getComputedStyle(element).transform
      if (!transform || transform === 'none') return 0
      return new DOMMatrixReadOnly(transform).m41
    }

    const getScaleX = (element: HTMLElement) => {
      const transform = getComputedStyle(element).transform
      if (!transform || transform === 'none') return 1
      const matrix = new DOMMatrixReadOnly(transform)
      return Math.hypot(matrix.m11, matrix.m12)
    }

    const animateSprite = (
      element: HTMLElement,
      x: number,
      opacity: number,
      duration: number,
      delay = 0,
    ) => {
      const fromX = getTranslateX(element)
      const fromOpacity = Number.parseFloat(getComputedStyle(element).opacity)
      element.getAnimations().forEach((animation) => animation.cancel())
      const animation = element.animate(
        [
          { transform: `translateX(${fromX}px)`, opacity: fromOpacity },
          { transform: `translateX(${x}px)`, opacity },
        ],
        { duration, delay, easing: 'ease', fill: 'forwards' },
      )
      animation.onfinish = () => {
        element.style.transform = `translateX(${x}px)`
        element.style.opacity = `${opacity}`
      }
    }

    const animateUnderline = (
      element: HTMLElement,
      origin: 'left' | 'right',
      scaleX: number,
      duration: number,
      delay = 0,
    ) => {
      const fromScaleX = getScaleX(element)
      element.getAnimations().forEach((animation) => animation.cancel())
      element.style.transformOrigin = `${origin} center`
      const animation = element.animate(
        [
          { transform: `scaleX(${fromScaleX})` },
          { transform: `scaleX(${scaleX})` },
        ],
        { duration, delay, easing: 'ease', fill: 'forwards' },
      )
      animation.onfinish = () => {
        element.style.transform = `scaleX(${scaleX})`
      }
    }

    const stopMotion = () => {
      ;[rightSprite, leftSprite, rightUnderline, leftUnderline].forEach((element) => {
        element.getAnimations().forEach((animation) => animation.cancel())
      })
    }

    const enter = () => {
      hovered = true
      setTextTiming('in')
      root.classList.add('is-hovered')

      if (prefersReducedMotion) {
        rightSprite.style.transform = `translateX(${ARROW_RUN}px)`
        rightSprite.style.opacity = '0'
        leftSprite.style.transform = 'translateX(0px)'
        leftSprite.style.opacity = '1'
        rightUnderline.style.transform = 'scaleX(0)'
        leftUnderline.style.transform = 'scaleX(1)'
        return
      }

      animateSprite(rightSprite, ARROW_RUN, 0, 200)
      animateSprite(leftSprite, 0, 1, 320, inDuration)
      animateUnderline(rightUnderline, 'right', 0, 1000)
      animateUnderline(leftUnderline, 'left', 1, 500, inDuration)
    }

    const leave = () => {
      hovered = false
      const outDuration = setTextTiming('out')
      root.classList.remove('is-hovered')

      if (prefersReducedMotion) {
        rightSprite.style.transform = 'translateX(0px)'
        rightSprite.style.opacity = '1'
        leftSprite.style.transform = `translateX(-${ARROW_RUN}px)`
        leftSprite.style.opacity = '0'
        rightUnderline.style.transform = 'scaleX(1)'
        leftUnderline.style.transform = 'scaleX(0)'
        return
      }

      animateSprite(leftSprite, -ARROW_RUN, 0, 200)
      animateSprite(rightSprite, 0, 1, 320, outDuration)
      animateUnderline(leftUnderline, 'left', 0, 1000)
      animateUnderline(rightUnderline, 'right', 1, 500, outDuration)
    }

    const onResize = () => {
      setTextTiming(hovered ? 'in' : 'out')
    }

    link.addEventListener('pointerenter', enter)
    link.addEventListener('pointerleave', leave)
    link.addEventListener('focus', enter)
    link.addEventListener('blur', leave)
    window.addEventListener('resize', onResize)

    return () => {
      link.removeEventListener('pointerenter', enter)
      link.removeEventListener('pointerleave', leave)
      link.removeEventListener('focus', enter)
      link.removeEventListener('blur', leave)
      window.removeEventListener('resize', onResize)
      stopMotion()
    }
  }, [])

  return (
    <div ref={rootRef} className={`hero__cta word-shift-button ${className}`.trim()}>
      <a ref={linkRef} className="word-shift-button__link" href={href} aria-label={text}>
        <span className="word-shift-button__underline" aria-hidden="true">
          <span ref={rightUnderlineRef} className="word-shift-button__underline-right" />
          <span ref={leftUnderlineRef} className="word-shift-button__underline-left" />
        </span>
        <span ref={wordRef} className="word-shift-button__word" aria-hidden="true">
          {characters(text)}
        </span>
        <span ref={rightArrowRef} className="word-shift-button__arrow word-shift-button__arrow--right" aria-hidden="true">
          <span ref={rightSpriteRef} className="word-shift-button__arrow-sprite"><ArrowIcon /></span>
        </span>
        <span className="word-shift-button__arrow word-shift-button__arrow--left" aria-hidden="true">
          <span ref={leftSpriteRef} className="word-shift-button__arrow-sprite"><ArrowIcon /></span>
        </span>
      </a>
    </div>
  )
}
