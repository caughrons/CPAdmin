import firebase from "firebase/app";
import "firebase/firestore";
import "firebase/functions";
import { firebaseConfig } from "@/config";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const firestore = firebase.firestore();
const functions = firebase.functions();

const INITIAL_PROMPT = `CruisNews Feed Generation + AI Image Trigger Prompt
(Cruiser-First, Balanced Intelligence Version)

Objective
Generate 18–26 high-value cruising intelligence items for private recreational cruising vessels (sail and power) 35–70 feet, including liveaboards and passagemakers.

All items must be:
• Published within the previous 48 hours only
• Relevant to small-boat cruising decisions, not commercial shipping
• Useful for navigation, anchoring, compliance, safety, fueling, provisioning, maintenance, passage planning, or cruising lifestyle

Vessel Scope Constraint (Critical)
Prioritize private recreational cruising vessels (sailboats and powerboats) 35–70 ft.
Exclude:
• Commercial shipping (container ships, tankers, bulkers)
• Ferries and passenger liners
• Offshore supply vessels
• Industrial fishing fleets
Commercial incidents may be included only if they directly affect private cruisers, such as:
• Port or channel closures
• Fuel availability or price impacts
• Safety exclusion zones
• Clearance, customs, or access restrictions

Content Balance & Tone Rules
• At least 60% of items must be neutral or constructive (planning, access, provisioning, maintenance, community, seasonal operations)
• No more than 30% may involve emergencies, disasters, or security incidents
• At most 1–2 items may involve large-scale tragedy, loss of life, or extreme disaster
• Avoid sensationalism; prioritize practical impact on cruisers

Content Priorities

Tier A — Incidents & Advisories (Maximum 20–25% of total items)
Include only when directly relevant to private cruisers:
• Accidents or injuries involving private cruising vessels
• Groundings, fires, sinkings, or SAR involving yachts
• Navigation warnings affecting small-boat routes or anchorages
• Port closures or safety zones impacting cruising access
• Security incidents involving yachts or marinas
• Equipment recalls affecting recreational vessels
⚠️ Do not over-represent Tier A. These items are important but limited.

Tier B — Cruiser Operations, Lifestyle & Planning (Minimum 40–50%)
Emphasize lived cruising intelligence:
• Marina openings, closures, dredging, or haul-out delays
• Clearance, visa, customs, port cost changes
• Fuel price changes, shortages, rationing affecting yachts
• Provisioning availability (produce, water, LPG, imports)
• Anchorage conditions (holding, swell, shoaling, moorings)
• Maintenance tips, parts availability, repair delays
• Cruiser rallies, regattas, community events
• Boat organization, efficiency, and passage preparation
• Simple recipes suitable for cooking underway
Tier B is core, not filler.

Regions to Prioritize
Caribbean, Mediterranean, Pacific, US East, US Gulf, US West, Southern Ocean, Global (only when cruiser-relevant)

Section Targets (Flexible, Not Forced)
Fill organically to reach 18–26 total items:
• Incidents & Advisories: 2–4
• Regulations / Visas / Port Costs: 2–4
• Boats / Gear / Tech: 3–4
• Destinations & Operations: 3–4
• Costs / Fuel / Insurance: 3–4
• Weather / NAVTEX / Routing: 2–4
• Cruising Intel / Lifestyle / Provisioning: 4–6
Do not force tragedy to meet section counts.

Data Streams to Actively Scan
• Notices to Mariners, NAVTEX, MSI (small-vessel relevant)
• Port Authority and marina bulletins
• Cruiser community reports and updates
• Fuel dock price updates and shortages
• Provisioning market disruptions
• Anchorage condition reports
• Recreational vessel recalls and advisories

Source Priority Order (Strict)
1. Cruiser community sources (Noonsite, CruisersForum, marina newsletters, local cruiser reports)
2. Local coastal newspapers & regional publications
3. Port authorities and national agencies (only when relevant to private vessels)
4. Commercial maritime publications (last resort, cruiser impact required)

Passagemaker Relevance Filter (Mandatory)
Exclude stories unless at least one applies:
• Small-boat navigation or anchoring impact
• Marina or port access changes
• Clearance, customs, or entry procedures
• Fuel, water, LPG, or provisioning access
• Maintenance, repairs, or spares logistics
• Weather effects on vessels under 70 ft
• Cruiser community or seasonal movement patterns

Output Format (JSON ONLY):
{
  "stories": [
    {
      "tier": "A" | "B",
      "section": "Incidents & Advisories" | "Regulations / Visas / Port Costs" | "Boats / Gear / Tech" | "Destinations & Operations" | "Costs / Fuel / Insurance" | "Weather / NAVTEX / Routing" | "Cruising Intel / Lifestyle / Provisioning",
      "headline": "String (8-12 words)",
      "content": "String (1-2 paragraphs with 3-6 sentences total, highlighting core takeaways, specific details, actionable information, and key facts from the story. Include relevant numbers, dates, locations, and practical implications for cruisers.)",
      "source": "https://direct-deep-link-to-actual-article.com (MUST be the specific article URL, not just the homepage)",
      "sourceDisplayName": "Source Name",
      "region": "Caribbean" | "Mediterranean" | "Pacific" | "US East" | "US Gulf" | "US West" | "Southern Ocean" | "Global",
      "generateImage": boolean,
      "timestamp": "YYYY-MM-DDTHH:MM:SSZ"
    }
  ]
}

Editorial Review for Image Selection:
After generating all valid stories, perform an editorial review pass.
Evaluate each story for urgency/safety impact, relevance to passagemakers, visual storytelling potential, geographic importance, and uniqueness/newsworthiness.
Select the top 4–6 stories that would most affect cruiser decisions, most interest long-range cruisers, and benefit most from visual treatment.
Set "generateImage": true for these selected stories, false for all others.

FINAL RULES
✅ Only include stories from the last 48 hours
✅ No generic travel or tourism content
✅ No commercial shipping focus
✅ Every item must help a cruiser navigate, anchor, comply, fuel, provision, maintain, stay safe, or plan a passage
✅ NEVER FABRICATE stories - if you cannot find enough real stories, return fewer stories
✅ If you can only find 5 real stories, return 5 stories - DO NOT make up stories to reach the target count
✅ Use DEEP LINKS - the source URL must point directly to the specific article, not just the homepage
✅ Content must be 1-2 paragraphs (3-6 sentences) with specific details and core takeaways
❌ NEVER fabricate stories
❌ NEVER invent sources, dates, or events
✅ IMPORTANT: It is better to return 8 real stories than 20 fabricated stories`;

const PROMPT_DOC_REF = firestore.collection("cruisnews_config").doc("prompt");

export async function fetchCruisnewsStories() {
  const snapshot = await firestore
    .collection("cruisnews_stories")
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function seedPromptDocument() {
  await PROMPT_DOC_REF.set({
    prompt: INITIAL_PROMPT,
    previousPrompt: null,
    provider: "claude",
    providerModel: "claude-sonnet-4-6",
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  const seeded = await PROMPT_DOC_REF.get();
  return seeded.data() ?? { prompt: INITIAL_PROMPT, previousPrompt: null };
}

export async function getCruisnewsPrompt() {
  const doc = await PROMPT_DOC_REF.get();
  if (!doc.exists) {
    return seedPromptDocument();
  }

  const data = doc.data() ?? {};
  if (!data.prompt) {
    const seeded = await seedPromptDocument();
    return seeded;
  }

  return data;
}

export async function saveCruisnewsPrompt(
  prompt,
  previousPrompt,
  provider,
  providerModel,
  imageBoilerplate,
  imagePromptConfig,
) {
  await PROMPT_DOC_REF.set(
    {
      prompt,
      previousPrompt: previousPrompt ?? null,
      provider: provider ?? "claude",
      providerModel: providerModel ?? "claude-sonnet-4-6",
      imageBoilerplate,
      imagePromptConfig,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function runCruisnewsPrompt() {
  const callable = functions.httpsCallable("generateStoryManual", {
    timeout: 540000,
  });
  const result = await callable();
  return result.data;
}

export async function deleteCruisnewsStory(storyId) {
  const callable = functions.httpsCallable("deleteStoryManual", {
    timeout: 120000,
  });
  const result = await callable({ storyId });
  return result.data;
}
