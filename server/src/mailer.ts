import nodemailer from 'nodemailer'
import type { Config } from './config.js'

export interface Mail {
  to: string
  subject: string
  text: string
}
export interface Mailer {
  send(mail: Mail): Promise<void>
}

/**
 * With SMTP settings: sends real email. Without them (development only): prints the email to the terminal,
 * so you can read the code and sign in without any email account.
 */
export function createMailer(cfg: Config): Mailer {
  if (!cfg.smtp) {
    return {
      async send(mail) {
        console.log(`\n[dev mail] To: ${mail.to}\n[dev mail] ${mail.subject}\n${mail.text}\n`)
      },
    }
  }
  const transport = nodemailer.createTransport({
    host: cfg.smtp.host,
    port: cfg.smtp.port,
    secure: cfg.smtp.port === 465,
    auth: cfg.smtp.user ? { user: cfg.smtp.user, pass: cfg.smtp.pass } : undefined,
  })
  return {
    async send(mail) {
      await transport.sendMail({ from: cfg.mailFrom, ...mail })
    },
  }
}

export function codeEmail(to: string, code: string, purpose: 'login' | 'withdrawal'): Mail {
  const what = purpose === 'login' ? 'sign-in' : 'withdrawal'
  return {
    to,
    subject: `Your PocketSend ${what} code: ${code}`,
    text:
      `Your PocketSend ${what} code is ${code}\n\n` +
      `It expires in 10 minutes and works once.\n` +
      `Never share this code. PocketSend will never ask you for it.\n\n` +
      `If you did not ask for this code, you can ignore this email.`,
  }
}
