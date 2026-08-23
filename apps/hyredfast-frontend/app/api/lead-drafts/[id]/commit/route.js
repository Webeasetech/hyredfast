import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { tryAuth } from "@/lib/auth";
import { ownsLeadDraft, notFound } from "@/lib/authz";
import {
  classifyRow,
  normaliseEmail,
  seedColumns,
  STATE_LABELS,
} from "@/lib/lead-draft";

/**
 * Promote a draft's finished rows into the campaign.
 *
 * This is the single gate between "anything goes" and "this will be emailed",
 * and the only place in the flow that validates. The checks are repeated here
 * rather than trusted from the client for two reasons: the client can be
 * bypassed outright, and the routes this replaces (`/api/contacts/import` and
 * `/api/contacts/import-file`) called createMany on raw input with no
 * validation at all, so leaving it client-side would carry that gap forward.
 *
 * Rows that fail stay in the draft with their reason, rather than being
 * silently dropped — the user came here to fix them, not to lose them.
 */
export async function POST(request, props) {
  const params = await props.params;
  const { id } = params;

  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;
  if (!(await ownsLeadDraft(auth.userId, id))) return notFound("Draft");

  try {
    const draft = await prisma.leadDraft.findUnique({
      where: { id },
      include: { rows: { orderBy: { position: "asc" } } },
    });
    if (!draft) return notFound("Draft");

    // Derived here rather than read off the draft, so the required fields are
    // whatever the templates ask for *right now* — not what they asked for when
    // the draft was started.
    const pitches = await prisma.pitchEmail.findMany({
      where: { campaignId: draft.campaignId },
      select: { message: true, subject: true },
    });
    const columns = seedColumns(pitches);

    // Seed the duplicate check with the contacts already in this campaign, so
    // the same pass catches both in-draft duplicates and re-adding someone the
    // campaign already holds.
    const existing = await prisma.campaignEmail.findMany({
      where: { campaignId: draft.campaignId },
      select: { email: true },
    });
    const seen = new Set(
      existing.map((c) => normaliseEmail(c.email)).filter(Boolean),
    );

    const committable = [];
    const skipped = [];

    for (const row of draft.rows) {
      const state = classifyRow(row, { columns, seen });
      if (state === "ready") {
        seen.add(normaliseEmail(row.email));
        committable.push(row);
      } else if (state !== "blank") {
        skipped.push({ id: row.id, reason: STATE_LABELS[state] });
      }
      // Blank rows are neither committed nor reported — they are just the empty
      // rows at the bottom of a grid.
    }

    if (committable.length === 0) {
      return NextResponse.json({ committed: 0, skipped });
    }

    const committedIds = committable.map((r) => r.id);

    // One transaction: either the contacts exist and the draft rows are gone,
    // or neither happened. A partial commit would leave the user re-adding
    // leads that were already created.
    await prisma.$transaction([
      prisma.campaignEmail.createMany({
        // Field shape matches what CSV import produced, so committed leads are
        // indistinguishable from previously imported ones downstream. `sentAt`
        // is set to now because the leads table sorts on it — it means "added
        // at", not "emailed at", for a PENDING row.
        data: committable.map((row) => ({
          name: row.name || "",
          email: (row.email || "").trim(),
          campaignId: draft.campaignId,
          status: "PENDING",
          verified: "PENDING",
          sentAt: new Date(),
          opened: 0,
          stage: 0,
          personalization: row.personalization || undefined,
        })),
      }),
      prisma.leadDraftRow.deleteMany({ where: { id: { in: committedIds } } }),
    ]);

    return NextResponse.json({ committed: committable.length, skipped });
  } catch (error) {
    console.error(`[API] Error committing draft ${id}:`, error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
