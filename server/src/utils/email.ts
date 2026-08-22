import nodemailer from 'nodemailer';

const isDev = process.env.NODE_ENV !== 'production';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: Number(process.env.SMTP_PORT) || 1025,
  secure: false,
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  } : undefined,
});

export async function sendEmail(to: string, subject: string, text: string, html?: string) {
  if (isDev || !process.env.SMTP_HOST) {
    console.log(`\n================ [DEV EMAIL FALLBACK] ================`);
    console.log(`TO: ${to}`);
    console.log(`SUBJECT: ${subject}`);
    console.log(`BODY: ${text}`);
    console.log(`======================================================\n`);
    return true;
  }

  try {
    await transporter.sendMail({
      from: '"Dayflow HRMS" <no-reply@dayflow.com>',
      to,
      subject,
      text,
      html,
    });
    return true;
  } catch (err) {
    console.error('Failed to send email:', err);
    return false;
  }
}
