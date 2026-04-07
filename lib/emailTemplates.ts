import type { Investor, NavRecord } from '@/types';

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function buildInvestorEmailHTML(
  investor: Investor,
  latestNav: NavRecord,
  portalUrl: string
): string {
  const monthName = MONTH_NAMES[latestNav.month];
  const isPositive = latestNav.monthly_return_pct >= 0;
  const returnColor = isPositive ? '#36D399' : '#F87171';
  const returnSign = isPositive ? '+' : '';
  const nav = latestNav.nav.toLocaleString('en-US', {
    style: 'currency', currency: 'USD'
  });
  const returnPct = `${returnSign}${latestNav.monthly_return_pct.toFixed(2)}%`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>OMA Funds — ${monthName} ${latestNav.year} Statement</title>
</head>
<body style="margin:0;padding:0;background:#07090f;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#eaf2ff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#07090f;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="padding:0 0 28px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#5AA7FF,#A78BFA);display:inline-block;vertical-align:middle;margin-right:10px;"></div>
                    <span style="font-size:15px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#eaf2ff;vertical-align:middle;">OMA Funds</span>
                  </td>
                  <td align="right" style="font-size:12px;color:#A6B4D0;">${monthName} ${latestNav.year} Statement</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:0 0 20px 0;">
              <p style="margin:0;font-size:15px;color:#A6B4D0;line-height:1.6;">
                Hi ${investor.name.split(' ')[0]},
              </p>
              <p style="margin:10px 0 0;font-size:15px;color:#eaf2ff;line-height:1.6;">
                Your ${monthName} ${latestNav.year} statement is ready. Here's a summary of your account performance.
              </p>
            </td>
          </tr>

          <!-- NAV Card -->
          <tr>
            <td style="background:#0e1628;border:1px solid #1b2a49;border-radius:16px;padding:28px 32px;margin-bottom:20px;">
              <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#A6B4D0;">Your Account Value</p>
              <p style="margin:0;font-size:38px;font-weight:800;letter-spacing:-1.5px;color:#eaf2ff;">${nav}</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
                <tr>
                  <td style="background:#070a12;border:1px solid #1b2a49;border-radius:12px;padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:11px;color:#A6B4D0;text-transform:uppercase;letter-spacing:.12em;">${monthName} Return</p>
                    <p style="margin:0;font-size:24px;font-weight:800;color:${returnColor};">${returnPct}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Spacer -->
          <tr><td style="height:20px;"></td></tr>

          <!-- CTA -->
          <tr>
            <td align="center">
              <a href="${portalUrl}/i/${investor.slug}"
                 style="display:inline-block;background:linear-gradient(135deg,#5AA7FF,#A78BFA);color:#fff;font-weight:700;font-size:14px;text-decoration:none;padding:14px 32px;border-radius:999px;letter-spacing:0.04em;">
                View Full Dashboard →
              </a>
            </td>
          </tr>

          <!-- Spacer -->
          <tr><td style="height:36px;"></td></tr>

          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #1b2a49;padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#A6B4D0;line-height:1.7;text-align:center;">
                This email was sent to ${investor.email} because you are an investor with OMA Funds.<br/>
                Questions? Reply to this email or contact <a href="mailto:statements@omafunds.com" style="color:#5AA7FF;">statements@omafunds.com</a>
              </p>
              <p style="margin:16px 0 0;font-size:11px;color:#4a5568;text-align:center;">
                Performance data is for informational purposes only and does not constitute investment advice.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function buildInvestorEmailText(
  investor: Investor,
  latestNav: NavRecord
): string {
  const monthName = MONTH_NAMES[latestNav.month];
  const returnSign = latestNav.monthly_return_pct >= 0 ? '+' : '';
  const nav = latestNav.nav.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  return `
OMA Funds — ${monthName} ${latestNav.year} Statement

Hi ${investor.name.split(' ')[0]},

Your ${monthName} ${latestNav.year} statement is ready.

Account Value: ${nav}
${monthName} Return: ${returnSign}${latestNav.monthly_return_pct.toFixed(2)}%

View your full dashboard at: ${process.env.NEXT_PUBLIC_PORTAL_URL}/i/${investor.slug}

Questions? Contact statements@omafunds.com

—
OMA Funds
Performance data is for informational purposes only and does not constitute investment advice.
  `.trim();
}
