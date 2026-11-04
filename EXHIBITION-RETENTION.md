# Exhibition release retention

Releases no longer expire or evict earlier visitors at a count limit. All saved
releases are sent to the shared aquarium, including after a process restart.
There is deliberately no public reset endpoint or automatic end-of-week deletion.

## Deployment prerequisite

The current Render Free instance has no persistent disk. Do not deploy this
revision until persistent storage is configured; on Render, startup requires
`AQUARIUM_DATA_DIR` rather than silently falling back to ephemeral storage.

1. Obtain approval for the paid compute plan and disk charge.
2. Capture the current `aquarium:state` before any change that restarts the service.
   Keep a collector connected during migration if visitors are actively releasing.
3. Upgrade the existing service and attach a persistent disk at `/var/data`.
4. Set `AQUARIUM_DATA_DIR=/var/data`. Do not change unrelated environment values.
5. If the pre-deploy snapshot contains releases, import them on the disk before
   switching visitors to the new release. The saved document is
   `{version:1, records:[{creature, clientReleaseId:""}]}`. Preserve original IDs,
   timestamps, catalog IDs and seeds; never overwrite an existing store.
6. Deploy the revision, verify health, then test a process restart and reconnect.
   All existing IDs must survive. Do not submit synthetic releases to production.

`releases.json` is written to a temporary file, synced, and atomically renamed
before acknowledging or broadcasting a release. A failed write returns a failure
to the visitor. Invalid stored JSON stops startup instead of resetting the data.
Client release IDs persist alongside each record to prevent retry duplicates.

Keep backups outside the disk before any manual archive/clear operation. Ending
the exhibition does not automatically stop hosting charges or remove records.
If the service is later downgraded, export its records first.

## Verification

Run `node scripts/verify-retention.cjs` from `wish-aquarium-realtime-v4` with the
project's dependencies installed. The test uses a temporary directory and local
port 3037, never the live service. Also run `npm run check` after asset unpacking.

Displaying every released creature can become expensive for the projector as
attendance grows. This change intentionally does not cap or rotate them out.
