# Future Embedded Signup

Embedded Signup is the future self-serve WhatsApp onboarding flow. It is not part of the first MVP implementation.

The MVP uses manual onboarding first because it is faster to sell, easier to support, and avoids blocking the first customers on Meta onboarding complexity.

## Future User Flow

1. Client clicks "Connect WhatsApp" inside the SaaS dashboard.
2. Client logs in with Facebook.
3. Client creates or selects a Meta Business Portfolio.
4. Client creates or selects a WhatsApp Business Account.
5. Client verifies or selects a WhatsApp phone number.
6. Meta returns:
   - WABA ID
   - phone number ID
   - an exchangeable code
7. Backend exchanges the code for a customer access token.
8. Backend registers/subscribes the phone number to webhooks.
9. SaaS stores the business connection securely.
10. SaaS marks WhatsApp as connected for that business.

## Backend Responsibilities Later

When implemented, the backend should:

- Receive the exchangeable code from the frontend.
- Exchange it server-side with Meta.
- Store customer token securely.
- Encrypt tokens before storage.
- Store WABA ID and phone number ID on the business connection.
- Register the phone number for webhooks if required.
- Subscribe the WABA/phone number to webhook events.
- Verify connection status.
- Avoid exposing tokens to the browser.

## Why Later

Manual onboarding comes first because:

- The product can be sold and tested faster.
- The operator can help small businesses through WhatsApp/Meta setup.
- Package, AI reply quality, knowledge management, and lead handling matter more for the first paid version.
- Billing is also deferred, so self-serve onboarding is not yet required.

Do not implement Embedded Signup until the manual-onboarding SaaS MVP is stable.
