/**
 * Sends a correctly signed fake `charge.success` to your local server, so you can see a payment arrive
 * without Kora. Needs SKIP_CHARGE_VERIFY=true in server/.env (because Kora has no record of this payment).
 *   npm run fake-webhook -- <virtual account number> <amount in naira> ["Payer Name"]
 */
import { createHmac, randomUUID } from 'node:crypto'

const [accountNumber, amount = '5000', payer = 'Test Sender'] = process.argv.slice(2)
if (!accountNumber) throw new Error('Usage: npm run fake-webhook -- <account number> <amount> ["Payer Name"]')
const secret = process.env.KORA_SECRET_KEY ?? ''
const port = process.env.PORT ?? '3001'

const data = {
  fee: 15,
  amount: Number(amount),
  status: 'success',
  currency: 'NGN',
  reference: `KPY-PAY-${randomUUID().slice(0, 12)}`,
  transaction_date: new Date().toISOString(),
  virtual_bank_account_details: {
    payer_bank_account: { bank_name: 'Test Bank', account_name: payer, account_number: '******1001' },
    virtual_bank_account: { bank_name: 'Wema Bank', account_number: accountNumber, permanent: true },
  },
}
const signature = createHmac('sha256', secret).update(JSON.stringify(data)).digest('hex')
const res = await fetch(`http://localhost:${port}/api/webhooks/kora`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-korapay-signature': signature },
  body: JSON.stringify({ event: 'charge.success', data }),
})
console.log(`Webhook answered ${res.status}`)
