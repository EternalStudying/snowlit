# Snowlit Domain Context

This file defines shared vocabulary. Rules are in the [current specification](docs/product/current-spec.md); architecture and execution state are in the relevant context files.

| Term | Current meaning |
|---|---|
| Account / business session | A backend users account and its issued token; WeChat binding is a server-side authentication relationship |
| Manager | Content-management authority defined by SiteManagerPolicy, never inferred from a name or client button |
| Home overview | Authenticated aggregation of couple, dailyNote, personStatuses, distance, latest, and stats |
| Album / draft | A published photo collection / an unpublished upload workspace owned by its creator |
| Private album access | Time-limited qualification obtained with the album password, checked separately from login and likes |
| Daily album activity | Like toggling and view deduplication by user, album, and UTC calendar day |
| Wish | A want_go or want_do goal that can become completed and be reopened under current permissions |
| Diary | Role/date-organized Markdown; shared/private controls visibility, while authorship controls mutation |
| Story moment | A public memory with category, time, place, address/coordinates, and up to three images |
| Weather / location | Independently resolved results for actual coordinates; failure must not create fabricated values |
| Calendar date / timestamp | YYYY-MM-DD preserves year/month/day; an offset-bearing timestamp represents an instant |
| Fallback | Preserving available content or an explicit unknown state when permissions, data, or providers fail |

The clients share one backend and business dataset. A couple-oriented product does not imply complete tenant isolation. Language, holidays, and platform choices do not establish the user's physical location.
