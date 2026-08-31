# ManyChat integration

Pushing signup and purchase state from the site into ManyChat, so a flow can
branch on whether someone already has an account or already bought.

Nothing here is built yet — this is the verified groundwork. Everything marked
**Verified** was checked against the live API or ManyChat's own docs on
2026-08-31; everything marked **Assumed** still needs confirming.

---

## The account

**Verified.** `GET /fb/page/getInfo` returns:

| | |
|---|---|
| Page | Clarity of Heart Yoga \| Therapeutic Yoga Method |
| Page ID | `118061298062575` |
| Username | `clarityofheartyoga` |
| Pro plan | `is_pro: true` — API access requires it |
| Timezone | `America/Phoenix` |

Existing tags at time of writing: only two auto-generated
`link_clicked (<timestamp>)` entries. Nothing to collide with.

---

## API basics

**Verified.**

- Base URL: `https://api.manychat.com`
- Auth: `Authorization: Bearer <API key>`
- API key: **Settings → API → Generate your API Key**. Regenerating disables
  every connected method, so rotate both sides together.
- All paths are prefixed `/fb/` regardless of channel — Instagram included.
  That's historical naming, not a Messenger-only restriction.

Errors come back structured, so handle `details.messages[]` rather than
string-matching on `message`:

```json
{
  "status": "error",
  "message": "Validation error",
  "details": { "messages": [{ "message": "subscriber_id cannot be blank." }] }
}
```

Rate limits are 10 requests/second on the write endpoints below, 100/s on
`findBySystemField`. Far above anything this integration will generate.

> ⚠️ **The key currently in use was pasted into a chat transcript and must be
> regenerated.** It grants write access to the whole audience — tagging,
> messaging, and account-wide tag deletion.

---

## Endpoints we need

**Verified** — payload shape confirmed by probing validation errors. No real
writes were made, so the *success* response body is still unseen.

### Tag someone

```http
POST https://api.manychat.com/fb/subscriber/addTagByName
Authorization: Bearer <key>
Content-Type: application/json

{ "subscriber_id": "1234567890", "tag_name": "signup" }
```

### Untag someone

```http
POST https://api.manychat.com/fb/subscriber/removeTagByName
{ "subscriber_id": "1234567890", "tag_name": "purchased:posture" }
```

> 🚨 **`/fb/page/removeTagByName` is a different endpoint that deletes the tag
> from the entire account.** One path segment apart from the one above, and
> irreversible. Only ever call the `/fb/subscriber/` form.

### Look someone up by email (fallback only — see below)

```http
GET https://api.manychat.com/fb/subscriber/findBySystemField?email=<email>
```

Accepts **only** `email` or `phone`. Returns `{"status":"success","data":[]}`
when nobody matches.

---

## How the site knows who's who

ManyChat identifies people by contact ID. The site identifies them by Clerk
user and email. Nothing joins those two unless we deliberately carry an
identifier across.

**Contact ID** is a ManyChat *General* System Field (available on Instagram),
and can be inserted into a link URL via the `{}` control in the button editor —
confirmed available on this account.

The chain:

1. **ManyChat link carries the contact ID.** The button URL becomes
   `https://www.movemindful.com/posture-routine?mc={{contact_id}}` — ManyChat
   substitutes each person's own ID as it sends.
2. **Site stores it in a first-party cookie** on landing (~30 days). A cookie
   rather than a query param because `buy()` drops the query string when it
   redirects to sign-up, and people wander around before signing up.
3. **Sign-up reads the cookie into Clerk `unsafeMetadata`** — the only channel
   Clerk's `<SignUp>` offers.
4. **`user.created` webhook copies it to `privateMetadata`**, because
   `unsafeMetadata` is client-writable and shouldn't be the durable copy. Then
   calls ManyChat to add the signup tag.
5. **RevenueCat webhook reads it off the Clerk user** it already fetches for the
   email, and adds or removes the purchase tag.

### Why not just match on email

Considered and rejected. `findBySystemField?email=` works, but it depends on
ManyChat *having* an email for the contact — Instagram doesn't supply one, so it
would mean asking for it in the DM flow, and then depending on it matching what
they type into Clerk. The carried ID has no friction and no mismatch.

Keep the email lookup in mind only as a fallback for contacts who arrive without
an `mc` parameter. Not worth building until something needs it.

---

## Tag vocabulary

**Deliberately identical to the Mailchimp tags** (see `lib/audience-tags.ts`),
so there's one vocabulary across both systems rather than two dialects.

| Tag | Set when | Removed when |
|---|---|---|
| `signup` | They create a Clerk account | never |
| `purchased:posture` | They own the 5-Day Reset | refund or revocation |
| `purchased:<slug>` | Any future paid product | refund or revocation |

Free products never produce a `purchased:` tag — there's no purchase. For the
free 12-minute routine, **`signup` is the completion signal**, because an
account is the only thing standing between someone and that class.

**Pre-create these in the ManyChat UI** before going live. It's unconfirmed
whether `addTagByName` auto-creates a missing tag, and pre-creating makes it
deterministic either way.

---

## The two flow shapes

### A — Free class offer

The thing you want to know is *did they make an account*, because that alone
gets them the class.

```
Send link (?mc={{contact_id}})
  ↓
WAIT — at least 1 hour, ideally 24
  ↓
Condition: has tag `signup`?
  ├─ YES → they're in. Nudge them to actually watch it.
  └─ NO  → never created an account. Re-send, or ask what got in the way.
```

### B — Paid offer (5-Day Reset)

Two levels, because "didn't buy" splits into two very different people.

```
Send link (?mc={{contact_id}})
  ↓
WAIT — at least 1 hour, ideally 24
  ↓
Condition: has tag `purchased:posture`?
  ├─ YES → bought. Exit the sequence.
  └─ NO  → Condition: has tag `signup`?
        ├─ YES → made an account, didn't buy. Warmest lead you have —
        │        they got far enough to sign up. Objection-handling angle.
        └─ NO  → never signed up at all. Much colder. Re-send the link.
```

### Rules that apply to both

**The wait step is not optional.** Tags land within seconds of the event, but
seconds after *the event*, not after you send the link. A condition checked
immediately will always see "no tag" and route everyone down the failure branch
— including people who are about to convert.

**An untagged contact is not proof of no account.** Tags only ever get set for
someone who clicked through *with* the `mc` parameter. Somebody who ignored the
link and signed up a week later from your bio has an account and no ManyChat
tag. Write the "no" branch so it still reads sensibly to a person who's already
a customer.

**Tags accumulate and never expire.** Someone can hold `signup` and
`purchased:posture` at once. Order conditions most-specific first — check
purchase before signup, as flow B does.

---

## Still to verify

- **Success response body** for `addTagByName` / `removeTagByName`. Probing only
  produced validation errors; one real call against a real contact settles it.
- **Whether `addTagByName` auto-creates** an unknown tag, or errors. Sidestepped
  by pre-creating the tags.
- **Whether removing a tag that isn't applied** errors or is a no-op. Matters
  for the refund path, which shouldn't need to check first.

---

## Build checklist

- [ ] Regenerate the API key; store as `MANYCHAT_API_TOKEN` (Vercel, secret,
      production only — never `NEXT_PUBLIC_`)
- [ ] Pre-create `signup` and `purchased:posture` tags in ManyChat
- [ ] Add `?mc={{contact_id}}` to the button URL in each flow
- [ ] `lib/manychat.ts` — mirrors `lib/mailchimp.ts`; add/remove by name,
      logs and returns false rather than throwing
- [ ] Cookie capture on landing, carried into `unsafeMetadata` at sign-up
- [ ] Clerk webhook: copy to `privateMetadata`, add `signup` tag
- [ ] RevenueCat webhook: add/remove `purchased:<slug>` alongside the existing
      Mailchimp reconcile
- [ ] Build the two flow shapes above

The cookie in steps 5–6 is the same mechanism `campaign:<ref>` attribution
needs. Doing both at once costs very little more than doing either alone — and
campaign attribution is the one thing on the funnel map that can't be
backfilled, so it's worth carrying along.

---

See [the funnel state map](https://claude.ai/code/artifact/bf219735-8756-4e34-9fb5-769cbf00365e)
for where this sits in the wider picture, and `README.md` for the Mailchimp side
that's already live.
