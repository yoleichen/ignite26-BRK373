-- Deterministic, synthetic seed data for CaseDesk: 8 accounts, 24 support cases, 12 knowledge articles.
-- All companies come from Microsoft's fictional sample names; no real customer data.
-- Safe to re-run: rows are matched on natural keys and inserted only when missing.
-- ORDER BY v.n makes identity values deterministic on an empty table (case 1, KB-3, and so on).
-- Connect to the CaseDesk database before running.

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() = N'master'
    THROW 50002, N'Connect to the CaseDesk database, not master.', 1;

BEGIN TRANSACTION;

INSERT INTO dbo.accounts (name, industry, tier, region)
SELECT v.name, v.industry, v.tier, v.region
FROM (VALUES
    ( 1, N'Contoso Pharmaceuticals', N'Life sciences',      N'Enterprise', N'North America'),
    ( 2, N'Fabrikam Logistics',      N'Transportation',     N'Premium',    N'Europe'),
    ( 3, N'Northwind Traders',       N'Retail',             N'Standard',   N'North America'),
    ( 4, N'Tailspin Toys',           N'Manufacturing',      N'Standard',   N'Asia Pacific'),
    ( 5, N'Woodgrove Bank',          N'Financial services', N'Enterprise', N'Europe'),
    ( 6, N'Litware Health',          N'Healthcare',         N'Premium',    N'North America'),
    ( 7, N'Alpine Ski House',        N'Hospitality',        N'Standard',   N'Europe'),
    ( 8, N'Wide World Importers',    N'Wholesale',          N'Premium',    N'Asia Pacific')
) AS v (n, name, industry, tier, region)
WHERE NOT EXISTS (SELECT 1 FROM dbo.accounts AS a WHERE a.name = v.name)
ORDER BY v.n;

INSERT INTO dbo.kb_articles (title, product_area, content, updated_at)
SELECT v.title, v.product_area, v.content, CAST(v.updated_at AS datetime2(0))
FROM (VALUES
    ( 1, N'Rotate the SAML signing certificate without locking users out', N'Single sign-on',
     N'Relecloud Connect accepts two SAML signing certificates at the same time so you can rotate without downtime. 1) In Admin > Security > Single sign-on, select Add secondary certificate and upload the new certificate from your identity provider (IdP) before you activate it in the IdP. 2) Activate the new certificate in the IdP. 3) Sign in with a test user; the audit log shows which certificate validated the response. 4) Remove the old certificate. If users already see "Invalid SAML response signature", the IdP is signing with a certificate Relecloud does not have yet: upload it as the secondary certificate and sign-in recovers within one minute. Administrators with a local password can always sign in at /admin-login.',
     '2026-09-12T10:00:00'),
    ( 2, N'Fix SCIM provisioning errors: 409 Conflict (user already exists)', N'User provisioning',
     N'A 409 Conflict from the SCIM endpoint means a user with the same userName or email already exists, usually a manually created or soft-deleted account. Deleted users are retained for 30 days. To fix: 1) In Admin > Users, filter by Deleted and permanently delete the matching user, or restore it and link it to the IdP with Admin > Users > Link to directory. 2) Make sure the IdP maps userName to the same attribute it used originally (for example the UPN, not the email alias); a changed mapping creates duplicate users. 3) Retry provisioning for the affected users from the IdP. Duplicates that were already created can be merged in Admin > Users > Merge.',
     '2026-08-30T09:00:00'),
    ( 3, N'Data sync is delayed or stuck in Pending', N'Data sync',
     N'Records show Pending sync when the device saved them locally but the sync service has not confirmed them. Common causes: the device was offline, the sync queue for the tenant is paused because a record failed validation, or the device clock is more than 5 minutes off. Steps: 1) In Admin > Data sync > Queue, check for a red Paused banner; open the failed record, fix or discard it, and select Resume queue. Pending records then process in order, usually within 10 minutes. 2) On the device, open Settings > Sync and select Sync now; confirm the device date and time are set automatically. 3) Records created during an outage upload automatically when connectivity returns; do not reinstall the app, because unsynced local changes are deleted on uninstall.',
     '2026-10-02T15:30:00'),
    ( 4, N'Handle API rate limits (HTTP 429 Too Many Requests)', N'API & webhooks',
     N'The REST API allows 100 requests per second and 10,000 write operations per minute per tenant. When a limit is exceeded the API returns HTTP 429 with a Retry-After header in seconds. Recommended client behavior: honor Retry-After, retry with exponential backoff and jitter, and keep at most 4 concurrent requests. For imports above a few thousand records, use the bulk endpoint POST /v2/bulk, which accepts up to 1,000 records per call and counts as one request. Nightly jobs should spread work over the full window instead of starting at the same minute as other jobs. Enterprise tenants can request a temporary limit increase for a migration through support.',
     '2026-09-25T08:00:00'),
    ( 5, N'Webhook delivery: signatures, retries, and duplicate events', N'API & webhooks',
     N'Every webhook is signed with HMAC-SHA256 using the endpoint secret, sent in the X-Relecloud-Signature header. After you rotate a secret, both the old and the new secret are valid for 24 hours; your receiver must validate against both during that window, otherwise every event fails with a signature mismatch. Compute the signature over the raw request body before any JSON parsing. Delivery is at least once: if your endpoint does not return 2xx within 10 seconds, the event is retried up to 8 times with backoff, so the same event can arrive more than once. Use the X-Relecloud-Event-Id header to discard duplicates.',
     '2026-10-05T11:00:00'),
    ( 6, N'Resolve mobile offline edit conflicts', N'Mobile app',
     N'When two people edit the same record while offline, the first change to reach the server wins and the second device shows a Conflict banner. Nothing is lost: open the record, select View conflict, and choose Keep mine, Keep theirs, or merge field by field. Unresolved conflicts stay on the device and block only that record. If the app shows old data after reconnecting, pull down to refresh or select Sync now; a force close is not required on version 6.2 or later. Ask users to update to the latest app version from their app store.',
     '2026-09-18T14:00:00'),
    ( 7, N'Payment failed: update the card or switch to invoice billing', N'Billing',
     N'If a renewal payment fails, the subscription stays fully active for 14 days and admins see a banner. To fix it, a billing admin opens Admin > Billing > Payment method and updates the card; the charge is retried within one hour. Most declines are caused by an expired card or a bank blocking an international charge. Customers on annual plans above 25 seats can switch to invoice billing with net-30 terms: open a billing case with the purchase order number and the accounts payable contact. Switching does not interrupt service.',
     '2026-09-01T09:30:00'),
    ( 8, N'Understand prorated charges after a plan change', N'Billing',
     N'Upgrading mid-term is charged immediately and prorated by day: you pay the price difference between the old and the new plan for the remaining days of the current term. The invoice shows one credit line for the unused part of the old plan and one charge line for the new plan. Downgrades take effect at the next renewal and are not prorated. Seat additions are prorated the same way as upgrades. Billing admins can download itemized invoices from Admin > Billing > Invoices.',
     '2026-08-20T13:00:00'),
    ( 9, N'Large report exports time out', N'Reporting',
     N'Interactive exports are limited to 250,000 rows or 5 minutes. Larger exports show "Export failed". Options: 1) Narrow the date range or add filters and export in batches, for example one quarter at a time. 2) Use Schedule export, which runs in the background without a time limit and emails a download link valid for 7 days. 3) For recurring analytics, enable the daily data feed in Admin > Integrations, which delivers CSV or Parquet files to your storage account.',
     '2026-09-29T10:15:00'),
    (10, N'Scheduled reports show the wrong time zone', N'Reporting',
     N'Scheduled reports render timestamps in the time zone of the report owner''s profile, not the recipient''s. Reports created through the API default to UTC. A one-hour shift after a daylight saving change usually means the owner profile uses a fixed UTC offset instead of a named time zone. Fix: the report owner opens Profile > Regional settings and selects a named time zone such as Europe/Paris or America/New_York; the next scheduled run uses it. Admins can also set a time zone on the report itself in Report > Schedule > Advanced.',
     '2026-09-08T16:45:00'),
    (11, N'Password reset or invitation emails are not arriving', N'Notifications',
     N'Relecloud sends email from notifications@mail.relecloud.example. If messages do not arrive: 1) Check Admin > Notifications > Delivery log; a status of Bounced or Blocked means the recipient mail server rejected it. 2) Ask your mail administrator to allowlist the sending domain and our published sending IP ranges, and to release quarantined messages. 3) Invitations expire after 7 days; resend them from Admin > Users. 4) As a workaround, admins can copy a one-time sign-in link for a user from Admin > Users > More > Copy invite link.',
     '2026-09-15T09:00:00'),
    (12, N'Export audit logs for a compliance review', N'Security & compliance',
     N'The audit log records sign-ins, permission changes, data exports, and configuration changes for 365 days. Security admins can export it from Admin > Security > Audit log: choose a date range of up to 90 days per export, filter by event type, and select Export CSV. For longer ranges, run several exports or stream events continuously to your SIEM with the audit log API. Exports themselves are recorded in the audit log.',
     '2026-08-25T12:00:00')
) AS v (n, title, product_area, content, updated_at)
WHERE NOT EXISTS (SELECT 1 FROM dbo.kb_articles AS k WHERE k.title = v.title)
ORDER BY v.n;

INSERT INTO dbo.support_cases
    (account_id, title, description, product_area, priority, status, opened_at, resolved_at)
SELECT a.id, v.title, v.description, v.product_area, v.priority, v.status,
       CAST(v.opened_at AS datetime2(0)), CAST(v.resolved_at AS datetime2(0))
FROM (VALUES
    ( 1, N'Contoso Pharmaceuticals', N'Field updates stuck in "Pending sync" since 08:00',
     N'Technicians'' completed work orders from this morning still show Pending sync in the dashboard. The mobile devices show the updates as saved. About 40 records are affected.',
     N'Data sync', N'High', N'New', '2026-10-27T09:12:00', NULL),
    ( 2, N'Woodgrove Bank', N'SSO sign-in fails after our IdP certificate renewal',
     N'Since we renewed the signing certificate in our identity provider last night, every user gets "Invalid SAML response signature". Admins with local passwords can still sign in.',
     N'Single sign-on', N'Critical', N'In Progress', '2026-10-27T07:45:00', NULL),
    ( 3, N'Fabrikam Logistics', N'Integration receiving HTTP 429 during nightly import',
     N'Our nightly job that pushes shipment updates through the REST API started failing with HTTP 429 Too Many Requests at around record 3,000.',
     N'API & webhooks', N'Medium', N'New', '2026-10-26T22:30:00', NULL),
    ( 4, N'Litware Health', N'New hires not provisioned from Microsoft Entra ID',
     N'The SCIM provisioning log shows 409 Conflict for three new nurses. Their accounts were created manually last month and then deleted.',
     N'User provisioning', N'High', N'Waiting on Customer', '2026-10-24T14:05:00', NULL),
    ( 5, N'Northwind Traders', N'Invitation emails never arrive',
     N'We invited 12 store managers yesterday and none of them received the invitation email. Spam folders are empty.',
     N'Notifications', N'Medium', N'In Progress', '2026-10-25T10:20:00', NULL),
    ( 6, N'Alpine Ski House', N'Daily occupancy report shows times one hour off',
     N'The scheduled 7:00 report arrives on time, but the timestamps inside it have been one hour behind since the clocks changed.',
     N'Reporting', N'Low', N'New', '2026-10-26T08:10:00', NULL),
    ( 7, N'Wide World Importers', N'Card payment declined on renewal',
     N'Our annual renewal payment failed and the admin banner says the subscription will be suspended. Finance wants to know the options.',
     N'Billing', N'High', N'New', '2026-10-27T02:15:00', NULL),
    ( 8, N'Tailspin Toys', N'Export of quarterly work order report times out',
     N'Exporting the Q3 work order report to CSV spins for several minutes and then shows "Export failed".',
     N'Reporting', N'Medium', N'In Progress', '2026-10-23T16:40:00', NULL),
    ( 9, N'Contoso Pharmaceuticals', N'Webhook calls rejected after rotating the secret',
     N'After rotating the webhook secret, our receiver rejects every event with "signature mismatch".',
     N'API & webhooks', N'High', N'Resolved', '2026-10-20T11:00:00', '2026-10-20T15:30:00'),
    (10, N'Fabrikam Logistics', N'Drivers see conflict banners after working offline',
     N'Two drivers edited the same delivery while offline. When they reconnected, both saw a conflict banner and one edit seems to be missing.',
     N'Mobile app', N'Medium', N'Waiting on Customer', '2026-10-22T09:30:00', NULL),
    (11, N'Woodgrove Bank', N'Unexpected charge after upgrading mid-month',
     N'The invoice shows an extra prorated line after we moved from Premium to Enterprise on the 14th. Finance wants an explanation.',
     N'Billing', N'Low', N'Resolved', '2026-10-15T13:00:00', '2026-10-16T09:10:00'),
    (12, N'Litware Health', N'Can Relecloud Connect run in our own data center?',
     N'Our security team asks whether we can host the platform on-premises in our own data center instead of using the cloud service.',
     N'Platform', N'Medium', N'New', '2026-10-27T10:05:00', NULL),
    (13, N'Northwind Traders', N'Sync delayed for one store after a network outage',
     N'Store 114 lost connectivity for two hours. Records created during the outage still have not reached headquarters.',
     N'Data sync', N'Medium', N'Resolved', '2026-10-18T12:00:00', '2026-10-18T14:20:00'),
    (14, N'Alpine Ski House', N'Password reset email not received',
     N'Our front-desk manager requested a password reset three times and no email arrived.',
     N'Notifications', N'Medium', N'Resolved', '2026-10-19T08:00:00', '2026-10-19T09:15:00'),
    (15, N'Wide World Importers', N'API returns 429 for bulk product updates',
     N'Pushing 20,000 product updates at once returns HTTP 429 after a few seconds.',
     N'API & webhooks', N'Medium', N'Resolved', '2026-10-17T05:40:00', '2026-10-17T11:00:00'),
    (16, N'Tailspin Toys', N'SCIM sync is creating duplicate users',
     N'Some users now exist twice after we enabled SCIM, once with the old username format.',
     N'User provisioning', N'High', N'In Progress', '2026-10-25T15:15:00', NULL),
    (17, N'Contoso Pharmaceuticals', N'Need an audit log export for an internal review',
     N'Compliance needs all admin sign-ins and permission changes from the last 90 days.',
     N'Security & compliance', N'Medium', N'Waiting on Customer', '2026-10-24T09:00:00', NULL),
    (18, N'Fabrikam Logistics', N'Weekly KPI report shows UTC instead of CET',
     N'Managers receive the weekly KPI report with UTC timestamps instead of Central European Time.',
     N'Reporting', N'Low', N'Resolved', '2026-10-14T07:00:00', '2026-10-14T10:30:00'),
    (19, N'Woodgrove Bank', N'Mobile app shows stale data after reconnecting',
     N'After a connectivity outage in a tunnel, the app kept showing yesterday''s schedule until it was force-closed.',
     N'Mobile app', N'Medium', N'New', '2026-10-26T17:25:00', NULL),
    (20, N'Litware Health', N'Switch from card payments to invoice billing',
     N'Procurement asks to move from credit card payments to invoice billing with net-30 terms.',
     N'Billing', N'Low', N'In Progress', '2026-10-23T11:45:00', NULL),
    (21, N'Northwind Traders', N'SAML certificate expires next week',
     N'Our identity provider shows the signing certificate used for Relecloud expires on 3 November. How do we rotate it without downtime?',
     N'Single sign-on', N'High', N'New', '2026-10-27T08:30:00', NULL),
    (22, N'Alpine Ski House', N'Webhook endpoint receives duplicate events',
     N'Our booking system receives some status-change webhook events twice.',
     N'API & webhooks', N'Low', N'Waiting on Customer', '2026-10-21T18:10:00', NULL),
    (23, N'Wide World Importers', N'Export of 18 months of shipments fails',
     N'A report export covering 18 months of historical shipments fails every time we try it.',
     N'Reporting', N'Medium', N'New', '2026-10-26T13:00:00', NULL),
    (24, N'Tailspin Toys', N'Invitation emails blocked by our mail gateway',
     N'IT confirmed the mail gateway quarantines messages sent by the platform.',
     N'Notifications', N'High', N'Resolved', '2026-10-16T10:00:00', '2026-10-16T16:45:00')
) AS v (n, account_name, title, description, product_area, priority, status, opened_at, resolved_at)
JOIN dbo.accounts AS a ON a.name = v.account_name
WHERE NOT EXISTS
(
    SELECT 1 FROM dbo.support_cases AS c
    WHERE c.account_id = a.id AND c.title = v.title
)
ORDER BY v.n;

COMMIT TRANSACTION;

SELECT N'accounts' AS table_name, COUNT(*) AS row_count FROM dbo.accounts
UNION ALL SELECT N'support_cases', COUNT(*) FROM dbo.support_cases
UNION ALL SELECT N'kb_articles', COUNT(*) FROM dbo.kb_articles;
