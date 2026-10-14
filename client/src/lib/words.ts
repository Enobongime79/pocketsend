const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

function below1000(n: number): string {
  let s = ''
  if (n >= 100) {
    s += `${ones[Math.floor(n / 100)]} hundred`
    n %= 100
    if (n) s += ' and '
  }
  if (n >= 20) {
    s += tens[Math.floor(n / 10)]
    if (n % 10) s += `-${ones[n % 10]}`
  } else if (n > 0) s += ones[n]
  return s
}

/** 100000 becomes "One hundred thousand naira". Shown under amount fields as a typo check. */
export function amountInWords(n: number): string {
  if (!n) return ''
  const scales: [string, number][] = [['billion', 1e9], ['million', 1e6], ['thousand', 1e3]]
  const out: string[] = []
  let rest = n
  for (const [name, v] of scales) {
    if (rest >= v) {
      out.push(`${below1000(Math.floor(rest / v))} ${name}`)
      rest %= v
    }
  }
  if (rest > 0) out.push(below1000(rest))
  const s = out.join(' ')
  return `${s.charAt(0).toUpperCase()}${s.slice(1)} naira`
}
