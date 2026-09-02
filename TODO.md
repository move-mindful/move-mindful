**Mailchimp automations - signup & purchase**

**Test Payment**

-check all tags (sources)

**Update manychat free class flows**

**Create manychat direct payment flows**

**Send Email to email list**







**Mailchimp Nuture sequence depending on state**

**Popup free class on paid page**

**Create Flows**

ManyChat, Comment class (free offer)

-account created, product not purchased

-account created, product purchased

-account not created - > reengage on manychat (needs way to check)



ManyChat, Comment posture (direct to 5 day paid)

-account not created -> reengage on manychat (needs way to check)

-account created, not puchased (abandon cart) 

-product purchased



ManyChat, comment other words for other free or paid products

-same as above two but with different tags





`source:posture` AND NOT `purchased:posture` — clicked buy while logged out, didn't finish. Your abandoned cart.

`source:posture-routine` AND NOT `purchased:posture` — took the free class, hasn't upgraded. A nurture sequence.

NOT `purchased:posture` — suppression on any sales send.



