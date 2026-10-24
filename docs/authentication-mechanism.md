# How Authentication Works

The API uses two tokens to keep users signed in across the web app and browser extension.

## Sign up and sign in

When a user signs up or signs in, the API checks their credentials and returns an access token and a refresh token. Passwords are stored as secure Argon2id hashes.

## Using the tokens

- **Access token:** Sent with API requests. It lasts 15 minutes.
- **Refresh token:** Used to get new tokens when the access token expires. It lasts 30 days.

When refreshing, the API replaces the old refresh token with a new one. The client must save and use the replacement. The API stores only a hash of each refresh token.

## Logout and token reuse

Each sign-in has its own token family. If an old refresh token is used again, the API revokes that family. Logging out also revokes the family, so it cannot be used to refresh the session.

An access token already issued can still work until it expires, for up to 15 minutes.

## Web app and extension

Both clients follow the same flow: send the access token with requests, use the refresh token to renew it, and save the replacement refresh token. Each client should store its tokens securely.
