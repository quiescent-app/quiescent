# Photo storage service boundary

`UploadService` in `apps/web/api/service/upload.service.ts` handles photo policy and
validation. `S3PhotoStorage` in `service/s3-photo.storage.ts` implements its
`PhotoStorage` interface. The service currently has no route or database wiring.

`UploadService` constructs its S3 adapter directly from `AWS_REGION` and
`S3_PHOTO_BUCKET`. The AWS SDK uses the backend process's credentials. Browser
code receives a temporary upload form, including its generated pending key,
but must not choose a key or receive AWS credentials.

## Service flow

1. `prepareUpload(ownerId, { contentType, sizeBytes })` checks the declared policy,
   generates a pending key, and returns a presigned POST target plus a
   `PendingPhotoUpload` record. The future persistence layer must save that record
   before returning the target to a client.
2. A browser submits the file and returned form fields directly to S3. The form
   expires after five minutes and limits the upload to 10 MiB.
3. The future persistence layer loads the pending record, checks ownership and
   state, and passes it to `completeUpload`. The service checks the S3 size,
   copies the object to a new final key, then decodes and validates the **copied**
   JPEG, PNG, or WebP bytes. It returns a `ReadyPhoto` record for persistence.
4. `createReadUrl` and `deletePhoto` accept only ready records loaded and
   authorized by server code.

The service rejects images above 16,777,216 decoded pixels and animated or
multi-page images. It does not resize or transform accepted files.

## Required integration work

`PendingPhotoUpload` and `ReadyPhoto` are trusted server-side records, not API
request shapes. Persistence must claim completion atomically, make repeat calls
idempotent, and authorize reads and deletion. It must also retain enough state to
remove a final object if saving `ReadyPhoto` fails, and retry deletion of
abandoned pending or final objects. Until those pieces exist, this service is
not an end-to-end upload feature.
