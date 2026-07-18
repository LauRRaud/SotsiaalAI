# Admin e-mail projection

Admin APIs use one server-side projection from `lib/admin/emailProjection.js`.
E-mail addresses are masked by default in analytics users, framework acceptances,
and usage support search responses.

`ADMIN_ANALYTICS_SHOW_FULL_EMAILS=true` is a temporary operational escape hatch.
Only the exact value `true` enables full addresses; missing, blank, malformed, or
other values remain masked (fail closed). Search may match a full address, but the
response, errors, and audit metadata must not echo it.

The target state is an audited support-case view rather than a global environment
switch. Do not use this flag for a browsable export or include addresses in logs.
