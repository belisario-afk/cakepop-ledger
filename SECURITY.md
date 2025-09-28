# Security Policy

Because this is a static client-only app with no backend, primary risks are:
- Malicious modification of code (supply chain) if dependencies are added later.
- User losing data due to LocalStorage clearing.

## Reporting a Vulnerability

Open a PRIVATE channel first (do not create a public issue if it reveals an exploit).  
Email: (replace with your email) or open a draft security advisory in GitHub.

## Data Security

All data resides in the browser only until exported. No transmission is performed.

## Recommended User Practices

- Export backups regularly.
- Avoid using public/shared computers.
- Keep browser updated.

## Future Hardening

- Optionally add data encryption (password-based) prior to export.
- Content Security Policy (meta tag already added).