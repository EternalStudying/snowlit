# Snowlit

A shared memory space for one couple, used through a Web client and a WeChat mini program that read and write the same records.

## People and access

**Member**:
One of the two people whose account belongs to the couple's space.
_Avoid_: user (when the person is meant), owner

**Couple role**:
Which partner a member is in the couple (boyfriend or girlfriend); diaries and home status are organised by it. A member without a couple role cannot keep a diary.
_Avoid_: gender, side, name-based role

**Manager**:
A member allowed to curate shared content: albums, story moments and wishes.
_Avoid_: admin, site owner, author

**Business session**:
A member's signed-in period, represented by a bearer token and ending after one hour or at logout.
_Avoid_: login state, JWT, WeChat session

**WeChat binding**:
The link between a WeChat identity and an existing member account; binding never creates an account.
_Avoid_: WeChat account, registration

**Guest**:
Someone who is not signed in; a guest sees only public story moments.
_Avoid_: anonymous user, visitor account

## Records

**Home overview**:
The signed-in landing summary of the couple: days together, the daily note, each partner's status, distance, latest records and totals.
_Avoid_: dashboard, home data

**Album**:
A published collection of photos, public or private.
_Avoid_: gallery, folder

**Draft**:
A member's unpublished album, diary entry or moment, saved on the server as they create it; at most one per member per kind. Publishing turns it into the real record and removes the draft.
_Avoid_: temporary album, upload session, autosave record

**Draft image**:
A photo uploaded into a draft before publishing; owned by the draft, deleted with it if the draft is discarded or the image is not used at publish.

**Private album access**:
A time-limited permission to see one private album, earned by entering its password; separate from being signed in.
_Avoid_: unlock state, album login

**Daily album activity**:
A member's like and view of one album on one UTC calendar day; each counts at most once per day.
_Avoid_: like record, view log

**Wish**:
Something the couple wants to go to (want_go) or do (want_do); it can be completed with a photo and reopened.
_Avoid_: todo, bucket-list item, plan

**Diary**:
A member's Markdown entry for one calendar day, either shared with the partner or private to its author.
_Avoid_: journal, post, note

**Story moment**:
A public memory with a category, time, place and up to three images.
_Avoid_: post, timeline item, footprint

**Message**:
A short note left on the couple's shared wall.
_Avoid_: comment, chat

**Notice**:
An update announcement shown to one client type, which a member can mute for the rest of the day.
_Avoid_: banner, popup, notification

**Feedback**:
A problem report or suggestion a member sends with up to three screenshots.
_Avoid_: ticket, bug report

## Time and place

**Calendar date**:
A year-month-day that means the same day everywhere, regardless of time zone.
_Avoid_: date-time, timestamp (for these values)

**Timestamp**:
An instant in time, shown in the viewer's local time.
_Avoid_: date (for these values)

**Resolved location**:
A place name actually returned for real coordinates; when nothing is returned the location stays unknown.
_Avoid_: default city, assumed location

**Fallback**:
Keeping what is already known, or showing an explicit unknown, when data, permission or a provider is unavailable.
_Avoid_: placeholder data, fake value
