# Supabase Auth Email Configuration

## Required: Set the redirect URL for password reset emails

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Set "Site URL" to:
   - Local:      http://localhost:3000
   - Production: https://port.omafunds.com

3. Under "Redirect URLs" add both:
   - http://localhost:3000/change-password
   - https://port.omafunds.com/change-password

4. Click Save

## How the full password flow works

### New investor (first login)
1. You create them in Admin Portal with a temp password
2. They log in at /login with their email + temp password
3. Portal detects force_password_change = true in their metadata
4. They are redirected to /change-password automatically
5. They set their own password → redirected to their dashboard
6. force_password_change flag is cleared — won't trigger again

### Forgot password
1. Investor clicks "Forgot password?" on the login page
2. They enter their email on /forgot-password
3. Supabase sends a reset email with a magic link
4. They click the link → lands on /change-password
5. They set a new password → redirected to their dashboard

## Email template customization (optional)
Go to Supabase Dashboard → Authentication → Email Templates
You can customize the "Reset Password" email to match OMA Funds branding.
Suggested subject: "Reset your OMA Funds portal password"
