# Security Policy

Because SmallBatch is a static, client-side app:
- No server stores your data.
- All secrets (GitHub token) that you enter are stored locally—treat them carefully.

## Potential Risks
- LocalStorage cleared = data loss (export often).
- Stolen device or malicious extensions could read LocalStorage (including gist token).
- Google ID token isn’t server-verified here (not strong auth, only user namespace separation).

## Recommendations
- Export backups regularly (plain or encrypted).
- Use encrypted export if storing backups in cloud drives.
- Use a token with only `gist` scope.
- Consider a backend if multi-user trust or validation matters.

## Reporting
Open a private channel (email or draft security advisory) before disclosing issues publicly.