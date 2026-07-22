import { BlurTextReveal } from '../motion/BlurTextReveal'
import { RotatingTextReveal } from '../motion/RotatingTextReveal'

type TitleBlockProps = {
  prefix?: string
  words?: string[]
  active?: boolean
  className?: string
}

export function TitleBlock({
  prefix = 'mean',
  words = ['something.', 'depth.', 'impact.'],
  active = true,
  className = '',
}: TitleBlockProps) {
  return (
    <div className={`title-block ${className}`.trim()}>
      <BlurTextReveal as="h1" text="Designed to" active={active} delay={0.1} />
      <RotatingTextReveal as="h1" prefix={prefix} texts={words} active={active} delay={0.15} />
    </div>
  )
}
