# ReelCaster Privacy Policy

**Effective Date:** {{EFFECTIVE_DATE}} · **Last Updated:** {{EFFECTIVE_DATE}} · **Version:** 2.0

This Privacy Policy explains how Copia Digital Incorporated ("Copia," "we," "us," or "our") collects, uses, discloses, and protects personal information when you use ReelCaster (the "Service"). It forms part of, and should be read with, our [Terms of Service](/terms).

We are the organization accountable for the personal information described here. Our Privacy Officer's contact details are in Section 14.

---

### Plain-language summary

This box is a convenience, not the policy. The numbered sections govern.

- We collect what we need to forecast fishing conditions for you: your account details, the spots you save, the catches you log, and the photos you upload.
- **Catch photos must contain camera metadata (EXIF), and we read and store the GPS coordinates, timestamp, and camera details from them.** That is how we verify a catch actually happened where and when you say it did. See Section 2.4.
- **Your catch photos are sent to Anthropic for automated species identification.** See Section 5.
- We use de-identified, aggregated data derived from your activity to improve our prediction models. We keep that after you leave. See Section 6.
- We show ads. That counts as "sharing" your information under California law, and you can opt out. See Section 8.
- We do not sell your catch coordinates or your precise location.
- Our servers and service providers are in the United States. See Section 9.

---

## 1. Scope

This policy applies to the ReelCaster application and to the ReelCaster websites. It does not apply to:

- The separate guide and reviewer portal, which has its own terms and notice;
- Third-party websites, apps, or services we link to.

## 2. Information We Collect

### 2.1 Information you give us

| What | Why we have it |
| --- | --- |
| Email address | Account identity, login, receipts, alerts, legal notices |
| Password | Login. Stored only as a salted hash, never in readable form |
| Name or display name, if you provide one | Personalization |
| Mobile phone number, if you enable text alerts | Sending and verifying text alerts |
| Home city, region, and unit preferences | Choosing what to show you |
| Support messages you send us | Answering you |

If you sign in with Google or GitHub, we receive your email address and basic profile information from that provider. We do not receive your password.

### 2.2 Fishing activity you create

- Spots you save, favourite, or create, including their coordinates
- Catch logs: species, size, date, time, gear or lure, and notes
- Alerts you configure, including thresholds, species, and lead times
- Spots and content you share with other users, and who you shared them with

### 2.3 Payment information

Payments made directly to us are processed by **Stripe**. Payments made in a mobile app are processed by **Apple** or **Google**. **We never receive or store your full card number, CVC, or bank details.** We receive and store a customer and subscription identifier, your subscription tier and status, billing period dates, the last four digits and brand of your card, and your billing country and postal code for tax purposes.

### 2.4 Photos and camera metadata

This is the most sensitive category we handle, so we are being specific about it.

When you upload a catch photo, we extract and store the following metadata from the image file on our servers:

- **GPS latitude and longitude**, and the GPS accuracy value, where the photo contains them
- **The date and time the photo was taken**
- Altitude, where present
- **Camera make and model, lens, ISO, and exposure settings**

**Photos that contain no usable camera metadata are rejected and not stored.** We require this metadata because it is how we verify that a catch log reflects a real event at a real place and time, which is what keeps the prediction models trustworthy. If you do not want us to hold precise coordinates from your photos, do not upload photos.

We compare the photo's GPS coordinates against the spot you logged the catch against. Where they agree, we use the photo's coordinates as the recorded location of the catch.

**Precise geolocation is treated as sensitive personal information under California law.** See Section 11.3 for your right to limit its use.

### 2.5 Usage and device information

Collected automatically:

- IP address, browser type and version, operating system, device type, and screen size
- Pages and screens you view, features you use, buttons you tap, and the sequence and timing of those actions
- Referring URL, entry page, and campaign parameters (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`)
- Which feature or screen you were on when you signed up or started a trial, and when you did so
- Server logs, including request paths, response codes, and timestamps
- Error and crash information

We use your IP address to make a coarse guess at your region so we can open the map somewhere useful. This is approximate, city-level at best. **We do not collect continuous or background device location.** If you grant the app permission to use your device location, we use it only while you are actively using the feature that asked for it.

### 2.6 Information from other sources

We ingest publicly available fishing reports and discussion from public forums and social media to inform regional condition summaries. This may occasionally include content that a person posted publicly under a username. We use it only in aggregate to describe conditions in an area, and our summaries are written so they do not identify individual posters or reproduce their posts.

## 3. Cookies, Local Storage, and Similar Technologies

| Purpose | What it is | Can you turn it off? |
| --- | --- | --- |
| Authentication | Session cookie that keeps you logged in | No. The Service will not work without it. |
| Preferences | Local storage holding your units, map view, and settings | Yes, by clearing site data. Your preferences will reset. |
| Analytics | Mixpanel, using local storage and a device identifier | Yes. See Section 11. |
| Advertising | Google AdSense cookies and identifiers | Yes. See Section 8 and Section 11.2. |

We honour the **Global Privacy Control (GPC)** browser signal as a valid opt out of the sale or sharing of personal information where the law requires us to.

## 4. How We Use Your Information

- **To provide the Service:** run forecasts and scores for your spots, show your catch history, send the alerts you configured, and keep you logged in.
- **To verify catch data:** compare photo metadata against logged spots so that fabricated or misplaced reports do not corrupt the models.
- **To identify species automatically:** see Section 5.
- **To bill you:** process subscriptions, renewals, refunds, and taxes.
- **To communicate with you:** receipts, security notices, service announcements, changes to our terms, and answers to your support requests.
- **To improve our models and the Service:** see Section 6.
- **To understand how the Service is used:** which features are used, where people get stuck, and which marketing brought people to us.
- **To show advertising:** see Section 8.
- **For security, fraud prevention, and enforcement:** detecting abuse, manipulated data, credential stuffing, and breaches of our Terms.
- **To comply with law:** tax records, lawful requests, and legal claims.

**Our legal basis.** In Canada we rely on your consent, which is express where you give us information directly or enable a feature such as text alerts, and implied for uses a reasonable person would expect, such as processing your subscription. You may withdraw consent as described in Section 11, subject to legal and contractual limits.

## 5. Automated Processing of Your Photos

When you upload a catch photo, **the image is transmitted to Anthropic, PBC in the United States** and analysed by a Claude model to estimate the species, the lure or bait visible, an approximate size, and the lighting conditions in the image. The result is stored with your catch log.

You can correct or delete any result. These estimates affect what the Service shows you and how catch data feeds our models. They do not produce any decision with a legal or similarly significant effect on you.

If you do not want your photos processed this way, do not upload photos. Catch logs can be created without one.

## 6. Derived Data and Model Improvement

We generate aggregated and de-identified data from your activity, which our [Terms of Service](/terms) call **Derived Data**. Examples are the environmental conditions that were present when fish were caught in an area, and the relationship between tide state and catch rate at a class of spot.

We use Derived Data to train, evaluate, and improve the ReelCaster prediction engine.

**What we do:** apply commercially reasonable technical and organizational measures to remove direct identifiers and to aggregate the data so it is not readily attributable to any individual.

**What we do not claim:** that de-identification is absolute. Precise location and time data can be re-identifiable in some circumstances, and we will not tell you otherwise.

**What we do not do:** sell your catch coordinates or precise location data to third parties, or publish your individual spots, catches, or photos to other users or publicly without your permission.

**Retention:** Derived Data is retained after your account is deleted, because it is no longer attributable to you and removing it is not possible without disproportionate effort. Once your original photos and logs are deleted, we do not derive anything further from them.

## 7. When We Disclose Personal Information

We do not sell your personal information. We disclose it in these circumstances only:

**To service providers who process it on our behalf**, under contract, for the purposes listed:

| Provider | What they process | Where |
| --- | --- | --- |
| Supabase | Database and authentication | United States |
| Vercel | Application hosting, CDN, server logs | United States |
| Stripe | Payment processing | United States |
| Twilio | Text message delivery and phone verification | United States |
| Resend | Transactional and alert email delivery | United States |
| Mixpanel | Product analytics | United States |
| Anthropic | Automated analysis of catch photos | United States |
| Google | Advertising, and app store billing where applicable | United States |
| Apple | App store billing where applicable | United States |

**To other users**, only what you choose to share, and only with the people you choose to share it with.

**For legal reasons:** to comply with a law, subpoena, warrant, court order, or other lawful request; to enforce our Terms; to investigate fraud, abuse, or data manipulation; or to protect the rights, property, or safety of any person. We assess each request and disclose only what we are legally required to disclose.

**In a business transaction:** if we are involved in a merger, acquisition, financing, reorganization, or sale of assets, personal information may be transferred as part of it. We will require the recipient to honour this policy, and we will notify you of any change of control.

## 8. Advertising

Parts of the Service display advertising served by **Google AdSense**. Google and its partners may use cookies and device identifiers to select ads and measure their performance, including based on your activity across other websites.

**Under the California Consumer Privacy Act, this counts as "sharing" personal information for cross-context behavioural advertising, and in some readings as a "sale."** You have the right to opt out. See Section 11.2.

We do not provide advertisers with your email address, phone number, catch logs, photos, spot coordinates, or precise location.

You can also manage Google's own ad personalization at [google.com/settings/ads](https://google.com/settings/ads).

## 9. Cross-Border Transfer and Storage

**We are a British Columbia company, but your personal information is stored and processed in the United States**, by the providers listed in Section 7.

While it is in the United States, your personal information is subject to United States law, and it may be accessible to United States courts, law enforcement, and national security authorities under the laws of that country. That access may occur without notice to you and without the protections available under Canadian law.

By using the Service, you acknowledge this transfer. If you are not comfortable with it, do not use the Service.

## 10. How Long We Keep Things

| Category | Retention |
| --- | --- |
| Account record and profile | For as long as your account is open, then deleted within **30 days** of account closure |
| Catch logs, photos, saved spots | Until you delete them, or within **30 days** of account closure |
| Text message and email delivery records | **12 months** |
| Billing and tax records | **7 years** from the transaction, as required by the *Income Tax Act* |
| Server and security logs | **90 days** |
| Analytics event data | **24 months** |
| Backups | Deleted data persists in encrypted backups for up to **90 days** before those backups age out |
| Derived Data (aggregated, de-identified) | Indefinitely. See Section 6 |
| Records we must keep for a legal claim, investigation, or regulatory obligation | As long as required, then deleted |

## 11. Your Rights and Choices

### 11.1 Everyone

- **Access.** Request a copy of the personal information we hold about you.
- **Correction.** Ask us to correct anything inaccurate or incomplete.
- **Deletion.** Close your account and have your personal information deleted, subject to the exceptions in Section 10.
- **Export.** Request a machine-readable copy of your catch logs, saved spots, and uploaded photos.
- **Withdraw consent.** Turn off text alerts by replying STOP or changing your notification settings. Unsubscribe from marketing email using the link in any such message. Withdraw consent to processing generally by closing your account. Some withdrawals mean we can no longer provide the Service.
- **Object to marketing.** Opt out of marketing at any time. We will still send transactional and account messages while you hold an account.

To exercise any of these, email {{PRIVACY_EMAIL}}. We will verify your identity, usually by confirming control of your account email, and respond within **30 days** as required by PIPEDA, or within **45 days** for California requests, with an extension where the law permits and we tell you why.

We will not discriminate against you for exercising any privacy right. We will not deny you the Service, charge you a different price, or give you a lower level of service.

### 11.2 Do Not Sell or Share My Personal Information

If you are a California resident, you may direct us not to share your personal information for cross-context behavioural advertising. Two ways:

1. Use the **"Do Not Sell or Share My Personal Information"** link in the footer of our website; or
2. Browse with **Global Privacy Control** enabled, which we treat as a valid opt-out signal.

Opting out does not remove ads. It means the ads you see are not selected based on your activity across other sites.

### 11.3 Limit the Use of Sensitive Personal Information

The precise geolocation we extract from your catch photos (Section 2.4) is **sensitive personal information** under California law. We use it only to provide the Service, verify catch data, and generate de-identified Derived Data, which are purposes California law permits without a further right to limit. We do not use it to infer characteristics about you, and we do not disclose it for advertising. If you want to stop us collecting it entirely, stop uploading photos, or delete the photos already uploaded.

### 11.4 California specifics

In the 12 months before the date of this policy, we collected the categories of personal information described in Section 2, from the sources in Section 2, for the purposes in Section 4, and disclosed them to the categories of recipients in Section 7. We shared identifiers and internet activity information for cross-context behavioural advertising as described in Section 8. We do not knowingly sell or share the personal information of anyone under 16.

You may use an authorized agent to make a request, with written proof of authorization.

### 11.5 Complaints

If you are not satisfied with our response, you may complain to:

- **Canada:** the Office of the Privacy Commissioner of Canada, [priv.gc.ca](https://www.priv.gc.ca)
- **British Columbia:** the Office of the Information and Privacy Commissioner for BC, [oipc.bc.ca](https://www.oipc.bc.ca)
- **California:** the California Privacy Protection Agency, or the Attorney General

We would rather hear from you first. Email {{PRIVACY_EMAIL}}.

## 12. Security

We use technical and organizational measures appropriate to the sensitivity of the information, including encryption in transit (TLS), encryption at rest for our database and backups, hashed passwords, role-based access controls limiting staff access to what their work requires, and logging of administrative access.

**No system is perfectly secure**, and we cannot guarantee the security of information you transmit to us. You are responsible for keeping your password confidential and for telling us promptly if you believe your account has been compromised.

**If a breach occurs** that creates a real risk of significant harm to you, we will notify you and the Office of the Privacy Commissioner of Canada as required by PIPEDA, and any other regulator the law requires, without unreasonable delay.

## 13. Children

The Service is not directed to children under 13, and we do not knowingly collect personal information from them. Anyone at least 13 but under the age of majority where they live may use the Service only with a parent or guardian, as set out in our [Terms of Service](/terms).

If you believe a child under 13 has given us personal information, contact {{PRIVACY_EMAIL}} and we will delete it.

## 14. Changes and Contact

**Changes.** We may update this policy. For material changes, we will notify you by email or by a prominent in-app notice at least **30 days** before they take effect, and we will increment the version number above. Non-material changes take effect when posted.

**Contact us.**

**Privacy Officer**
Copia Digital Incorporated
{{MAILING_ADDRESS}}
Victoria, British Columbia, Canada
Telephone: {{PHONE}}
Privacy requests and questions: {{PRIVACY_EMAIL}}
General and support: {{CONTACT_EMAIL}}
