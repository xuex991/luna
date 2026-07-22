import { WordShiftButton } from '../ui/WordShiftButton'

type StartProjectBlockProps = {
  text?: string
  href?: string
  className?: string
}

export function StartProjectBlock({ text = 'Start a project', href = '#contact', className = '' }: StartProjectBlockProps) {
  return <WordShiftButton text={text} href={href} className={className} />
}
