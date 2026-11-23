# Profile image uploads

Adding or replacing a profile image takes two steps.

1. **[Prepare the upload](#prepare-the-upload).** The API returns an upload ID
   and a presigned S3 form. The client uses the form's URL and fields to send
   the image directly to S3.
2. **[Complete the upload](#complete-the-upload).** The client sends the upload
   ID from step 1 to the API. The API verifies the uploaded image and makes it
   the user's current profile image.

## How prepare and complete work

### Prepare the upload

1. Send the file's `contentType` and `sizeBytes` to the prepare endpoint.
   The API accepts `image/jpeg`, `image/png`, and `image/webp` for files of
   1 byte through 10 MiB. `contentType` is the MIME type that identifies the
   file format.
2. Add every returned `target.fields` entry to `FormData`, then append the
   image last as `file`. POST the form to `target.url` within five minutes.
   S3 stores the file at the pending key along with its declared size and
   completion deadline.

See the [endpoint reference](#api-endpoints) for request and response shapes.

### Complete the upload

1. After S3 accepts the file, call the complete endpoint with the upload ID
   in the path and an empty body.
2. The API checks that the pending upload belongs to the signed-in user, is
   within its deadline, and matches the declared size. It then makes a staging
   copy and decodes it to check that it matches the declared format and has a
   single frame.
3. If validation succeeds, the API publishes the staging copy as the current
   profile image. The existing profile image stays in place until publication
   succeeds.

## S3 object stages

| Stage | S3 key | Purpose |
| --- | --- | --- |
| Pending | `pending/profile/<ownerId>/<uploadId>` | The browser uploads here using the presigned form. The API locates this object using the authenticated owner and the upload ID. |
| Staged | `pending/validated/<randomId>` | The API creates a private copy for validation and publication. |
| Final | `photos/profile/<ownerId>` | This stable private key holds the user's current profile image. A successful replacement overwrites it. The read and delete endpoints use this key. |

### Why the API uses a staging copy

The browser could upload image B to the pending key after the API checked
image A there. The form still allows writes to that key until it expires.
Publishing from the pending key at that point would use image B. Staging lets
the API publish the exact bytes it validated.

### Errors and cleanup

| When | What happens |
| --- | --- |
| The pending upload is missing, expired, belongs to another user, or has invalid metadata | The API returns `404`. Any pending object stays in S3 for lifecycle cleanup. |
| The pending object's size differs from the declared size | The API returns `400` and leaves the pending object for lifecycle cleanup. |
| The staging copy fails validation | The API returns an error and attempts to delete the staging copy. The pending object remains eligible for lifecycle cleanup. |
| Publication succeeds | The API attempts to delete both temporary copies. |

The S3 lifecycle rule clears temporary objects left behind by failed cleanup,
abandoned uploads, or a browser reusing an unexpired form.

## API endpoints

All four API endpoints require the account's Bearer access token. The direct
S3 POST uses the presigned form fields.

| Method and path | Request | Success response |
| --- | --- | --- |
| `POST /users/me/profile-image/uploads` | JSON body with `contentType` and `sizeBytes` | `201` with `{id, target: {url, fields, expiresAt}}` |
| `POST /users/me/profile-image/uploads/:id/complete` | Upload ID in the path and an empty body | `200` with `{id}` after publication |
| `GET /users/me/profile-image` | Empty body | `200` with `{image: null}` or `{image: {url}}`. The signed read URL expires after five minutes. |
| `DELETE /users/me/profile-image` | Empty body | `204 No Content` |

## Storage configuration

- Set `AWS_REGION` and `S3_PHOTO_BUCKET` in the API environment.
- Use a private bucket and allow browser POST requests from the web origin in
  its CORS configuration.
- Apply a lifecycle expiration rule to `pending/` to cover both pending
  uploads and staged copies.
