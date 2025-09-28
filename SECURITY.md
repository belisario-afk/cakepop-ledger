# Security Policy

Because SmallBatch is client-only:
- No server copy of your data.
- LocalStorage secrets (gist token) can be read by malicious extensions or if device compromised.

## Recommendations
- Regular encrypted exports.
- Use least-privilege gist token (only `gist`).
- Consider a backend for multi-user trust or token verification.
- Keep browser updated.

## Reporting
Open a (private) security advisory if you find a vulnerability.