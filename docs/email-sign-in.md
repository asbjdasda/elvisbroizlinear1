# Email sign-in

The portfolio uses Supabase Auth for passwordless sign-in and registration. The code entry, resend, verification, sessions and sign-out work on each of the site's deployment domains.

1. In Supabase Auth, enable Email and new registrations. Set the email OTP length to six digits and configure an expiry and send rate limits.
2. Configure a production SMTP sender on a verified domain. The default Supabase SMTP service restricts delivery to project team addresses.
3. In the **Magic Link** and **Confirm signup** email templates, include the six-digit token using `{{ .Token }}`.
4. Set `VITE_SUPABASE_URL` (the HTTPS project URL) and `VITE_SUPABASE_PUBLISHABLE_KEY` (the public browser key) in the production build environment, then rebuild and deploy the same bundle to each site. The private service role key and SMTP password belong only in the provider.
5. Request a code from Sign Up for a new visitor or Log in for an existing visitor. Open the delivered email and enter its code on the requesting site. Reload to verify the session, then log out. Sessions are scoped to each site origin.

If the two public settings are absent, the form reports that email sign-in is temporarily unavailable. Likes and comments use per-film local storage on the current device.
