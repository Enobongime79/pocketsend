import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button, type ButtonProps } from './Button'

/** Uses the Clipboard API, and falls back to selecting hidden text for in-app browsers that block it. */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  }
}

interface Props extends Omit<ButtonProps, 'onClick' | 'children'> {
  text: string
  label?: string
}

export function CopyButton({ text, label = 'Copy', variant = 'secondary', ...rest }: Props) {
  const [copied, setCopied] = useState(false)
  const onClick = async () => {
    if (await copyText(text)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }
  return (
    <>
      <Button variant={variant} onClick={onClick} {...rest}>
        {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
        {copied ? 'Copied' : label}
      </Button>
      <span className="sr-only" role="status">{copied ? 'Copied to clipboard' : ''}</span>
    </>
  )
}
