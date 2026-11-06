# Free authentication email options for EatFirst V2

Researched from official documentation on 2026-11-06. No purchase, provider signup, production change or V2 deployment was made during this research.

## Recommendation

Use **Brevo Free with an individually verified sender**, subject to account approval and successful delivery tests. You can use your existing Proton inbox to register and receive the sender-verification code. Brevo supplies the SMTP relay; paid Proton SMTP is not involved.

Brevo documents 300 email sends/day with no time limit on Free. It documents verifying an individual sender by an emailed code when its domain is not authenticated. Its deliverability fallback rewrites unauthenticated/free-domain senders to a Brevo-controlled `brevosend.com` address. Recipients may therefore see a Brevo-domain address rather than the original Proton address.

This is a documented no-owned-domain route, not a guarantee of eligibility or delivery for an unconfigured account. Brevo's Supabase integration guide recommends an authenticated sending domain for reliable delivery. If Brevo requires domain verification or transactional activation for this account, stop and request clarification/activation from Brevo; do not buy a domain or turn off Supabase email confirmation as a workaround.

## Comparison

| Service                 | Published free allowance                                                | SMTP     | Domain/eligibility considerations                                                                                                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Brevo Free              | 300 sends/day; no plan time limit                                       | Yes      | Individual sender email verification documented; sender-domain rewrite may be applied. Account/transactional activation and actual delivery still need verification. Best no-domain SMTP candidate among these options.  |
| Resend Free             | 3,000 emails/month; 100/day                                             | Yes      | SMTP documentation requires a verified domain. Shared test sending is not a replacement for family-wide delivery.                                                                                                        |
| SMTP2GO Free            | 1,000/month; 200/day; additional hourly limit without a verified domain | Yes      | Although single-sender verification exists, the current signup guide requires a business/domain-based address and says a domain is needed when you lack one. Not a fit for the stated Proton-only/no-domain constraints. |
| Mailjet Free            | 6,000/month; 200/day                                                    | Yes      | Individual sender verification exists, but Mailjet explicitly warns of delivery problems with free-webmail From addresses. Not a stronger reliability choice here.                                                       |
| Supabase default sender | 2/hour; sends only to organization-team addresses                       | Built in | Development/testing only; family app membership is not Supabase organization membership. Do not grant family members dashboard access to work around this.                                                               |
| Zoho personal Mail      | Consumer mailbox SMTP exists                                            | Yes      | Zoho's usage policy excludes automated/transactional mail, including account activation. Not suitable for EatFirst auth messages.                                                                                        |

Quotas are much larger than 5–10 family members normally need; sender eligibility, account approval and deliverability are the deciding factors.

## Minimal Brevo setup

1. Create a **Free** Brevo account using your Proton email and verify that account. Enable account 2FA. No paid add-ons are needed for the proposed route.
2. Open **Settings → Senders, Domains, IPs → Senders → Add a sender**. Use name `EatFirst` and your Proton email. Complete the emailed sender-verification code. You cannot authenticate `proton.me` as a domain you own; use individual sender verification.
3. Open **Settings → SMTP & API → SMTP**. Generate a dedicated SMTP key named `EatFirst`. Copy the exact **SMTP Login** displayed there; it may differ from your login email.
4. In Supabase **Authentication → Emails → SMTP Settings**, enter:

| Field        | Value                                    |
| ------------ | ---------------------------------------- |
| Sender name  | EatFirst                                 |
| Sender email | The exact sender email verified in Brevo |
| Host         | smtp-relay.brevo.com                     |
| Port         | 587 (STARTTLS)                           |
| Username     | The SMTP Login displayed in Brevo        |
| Password     | The dedicated Brevo SMTP key             |

Store that key only in Supabase's server-side SMTP configuration. Do not use your Proton password, Brevo account password or a Brevo HTTP API key. Do not put SMTP credentials into Vite, GitHub frontend secrets or chat. Keep **Confirm email** enabled and retain the configured Pages Site URL/redirect URL.

If transactional sending is not activated, ask Brevo to approve the account for low-volume signup confirmations and password recovery for a private family grocery app. Do not fabricate business details.

Before release, check one actual signup-confirmation and password-recovery email to inboxes the owner controls, inspect delivery logs/spam folders and confirm the links complete their intended flows. The app's household invitations are already private, single-use, expiring links that can be shared through Proton/WhatsApp/etc.; automatic invitation-email sending is not falsely claimed.

## Secure fallback if no-domain sending is refused

OAuth is a genuinely free, domain-free authentication alternative supported by Supabase, rather than another SMTP relay. A Google account can use an existing third-party email address without creating a Gmail mailbox. Supabase handles verified provider sign-in; account recovery is then handled by the identity provider, while EatFirst's household invite links and database privacy rules remain in place. Some family members would need a provider account, and the app would need a tested sign-in UI/provider configuration change before release. Email/password confirmation must not simply be disabled.

Invitation-only registration alone does not solve delivery: Supabase's email invitation and password-recovery flows still need a working sender. No alternative auth route has been silently enabled or deployed.

## Official sources

- Brevo Free plan limits: https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan
- Brevo sender verification: https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email
- Brevo sender-domain rewrite: https://help.brevo.com/hc/en-us/articles/16045394674066-Troubleshooting-Domain-authentication
- Brevo SMTP settings: https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP
- Brevo/Supabase integration and domain recommendation: https://developers.brevo.com/docs/supabase-smtp-integration
- Resend pricing: https://resend.com/pricing
- Resend SMTP prerequisites: https://resend.com/docs/send-with-smtp
- SMTP2GO Free: https://support.smtp2go.com/hc/en-gb/articles/223087947-Free-Plan
- SMTP2GO signup requirements: https://support.smtp2go.com/hc/en-gb/articles/12747932085145-Quick-Start-Guide
- Mailjet pricing: https://www.mailjet.com/pricing/
- Mailjet freemail sender warning: https://documentation.mailjet.com/hc/en-us/articles/19308800104091-Why-you-should-avoid-free-webmail-as-a-sender-address
- Supabase custom SMTP/default limits: https://supabase.com/docs/guides/auth/auth-smtp
- Zoho policy: https://www.zoho.com/mail/help/usage-policy.html
- Supabase Google OAuth: https://supabase.com/docs/guides/auth/social-sign-in/auth-google
- Google accounts with existing email: https://support.google.com/accounts/answer/27441

## Independent release checks completed

Both CI runs for application commit `b2d71ad` passed: lint, typecheck, 38 unit tests, independent PostgreSQL security/cleanup checks, actual local GoTrue/PostgREST/Mailpit and two-browser tests, six desktop/mobile regression tests and configured production build. Hosted two-user realtime, isolation, conflict/retry and migration tests had already passed before the three agreed temporary accounts and their fixture households were removed. All three deleted accounts were checked and could no longer authenticate. Pages-path PWA/icon/scope/offline checks also passed. Production `main` remains on the V1 release; V2 is not merged or published.
