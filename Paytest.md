### Before you touch anything

**Clear the two tags off your own ManyChat contact.** You added `signup` and `purchased:posture` to yourself by hand to wire the conditions. If they're still there, this whole test proves nothing — you can't tell an integration that worked from tags you set yourself last week.

**Use a fresh email for the Clerk account.** `signup` only fires on `user.created`, so an existing account produces no webhook at all. A `+alias` is fine — just know it lands in Mailchimp too.

**Do the entire flow inside the Instagram in-app browser.** The cookie lives in that webview's jar. If you hit "Open in Safari" partway through, the cookie doesn't come with you, the join silently fails, and you'll spend an hour debugging code that's fine. That's also the single most realistic failure mode for real users, so it's worth seeing the happy path work in the webview first.

**Have the Vercel function logs open** while you go. Reconstructing afterwards is much harder than watching it happen.

### Checkpoints

**1 · The link.** Comment on the post, tap Get Access. Before the page loads, check the URL carries `?mc=` followed by a run of digits — not the literal `{{contact_id}}`, and not glued onto `posture`.

**2 · Sign-up.** Click buy on `/posture`, land on `/sign-up?redirect_url=/posture`. The `mc` is gone from the URL here — that's expected and exactly why the cookie exists. Create the account.

Within about thirty seconds:

- **Clerk dashboard → the new user → private metadata contains `{"mc": "…"}`.** This is the join. If this is right, everything downstream will work; if it's missing, nothing else can.
- **ManyChat contact has `signup`.**
- **Mailchimp has the member with `signup` and `source:posture`.**
- **Vercel logs: `/api/webhooks/clerk` returned 200.** A 500 means it'll retry — wait and re-check rather than assuming failure.

**3 · Purchase.** Buy with your card.

- **ManyChat contact gains `purchased:posture`.**
- **Mailchimp gains `purchased:posture`.**
- **Logs show `[rc-webhook] … now holds: purchased:posture`.**
- **You should \*not\* see `falling back to unsafeMetadata`.** If you do, the Clerk webhook hadn't finished promoting before you bought. The tag still lands — that's what the fallback is for — but it means the promotion was slow, which is worth knowing.
- The product unlocks in the account.

### Worth doing while you're here

**Refund it afterwards.** That's the only way to exercise `removeTagByName`, which is the last genuinely unverified thing in manychat.md — nobody has ever confirmed whether removing a tag errors or no-ops, and the reconcile depends on it.

Watch for `purchased:posture` disappearing from both systems, and grep the logs for `[manychat] remove`. Two possible outcomes, both useful: a clean 200 means removal just works; a `returned 400 — treating as already absent` warning alongside the tag actually vanishing tells you ManyChat is noisy but correct, and I can tighten the handling.

One caveat — Stripe generally doesn't return the processing fee on a refund, so the round trip costs you a few percent of the sale price.