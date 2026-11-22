# Profile image uploads

The user routes call `UploadService` through the existing user controller. The
service uses the authenticated account ID to select the current image's private
S3 key. A signed, five-minute upload ticket binds an upload ID, owner, size,
and content type. The shared S3 adapter in `apps/web/api/storage/s3.storage.ts`
accepts a caller-supplied MIME type. `UploadService` enforces the photo policy.
The ticket uses a separate signing key derived from
`JWT_SECRET`. Profile image uploads use S3 for state and bytes.

## Web API

All requests to the API require the account's Bearer access token.

| Request | Result |
| --- | --- |
| `POST /users/me/profile-image/uploads` | Send `{contentType, sizeBytes}`. Returns `201` with `{id, uploadToken, target: {url, fields, expiresAt}}`. |
| `POST /users/me/profile-image/uploads/:id/complete` | Send `{uploadToken}` from the prepare response. Returns `200` with `{id}` after validation and publication. |
| `GET /users/me/profile-image` | Returns `{image: null}` or `{image: {url}}`. The private read URL expires after five minutes. |
| `DELETE /users/me/profile-image` | Removes the current image and returns `204`. |

Append the form fields to `FormData`, append the file last as `file`, and POST
to the returned S3 URL. Call the completion endpoint after the S3 upload
succeeds. Invalid, expired, and differently owned upload tickets return
`404`.

The API accepts JPEG, PNG, and WebP images up to 10 MiB. The previous image
stays current until the verified replacement is copied to the owner's S3 key.
The validation copy is separate from the browser's writable key. Concurrent
successful replacements use the last completed S3 copy.

## Storage configuration

Set `AWS_REGION` and `S3_PHOTO_BUCKET` in the API environment. Use a private
bucket with browser CORS that allows POST from the web origin, and an S3
lifecycle expiration rule on `pending/` for abandoned uploads and validation
copies. The upload form can be reused until expiration, so the lifecycle rule
also removes any pending object recreated after completion.
