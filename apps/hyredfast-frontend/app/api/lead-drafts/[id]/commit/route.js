import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { tryAuth } from "@/lib/auth";
import { ownsLeadDraft, notFound } from "@/lib/authz";
import { ensureCompany, companyContactRoom } from "@/lib/quota";
import { roleSlug as toRoleSlug } from "@/lib/company";
import { MAX_ACTIVE_CONTACTS_PER_COMPANY } from "@/lib/constants/plans";
import {
  classifyRow,
  groupRows,
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
 * It is also where the billable hierarchy gets built. A draft group is a
 * company/role pairing; committing it resolves a Company (consuming a quota
 * slot only if that employer is new to the user) and an Application under it,
 * and every contact created points at that application.
 *
 * Rows that fail stay in the draft with their reason, rather than being
 * silently dropped — the user came here to fix them, not to lose them. That
 * now covers the two server-side limits as well: a group whose company would
 * exceed this month's allowance, and contacts past the per-company cap.
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
    const pitches = await prisma.pitchTemplate.findMany({
      where: { campaignId: draft.campaignId },
      select: { message: true, subject: true, dynamicSubject: true },
    });
    const columns = seedColumns(pitches);

    // Seed the duplicate check with the contacts already in this campaign, so
    // the same pass catches both in-draft duplicates and re-adding someone the
    // campaign already holds.
    const existing = await prisma.campaignLead.findMany({
      where: { campaignId: draft.campaignId },
      select: { email: true },
    });
    const seen = new Set(
      existing.map((c) => normaliseEmail(c.email)).filter(Boolean),
    );

    const skipped = [];
    const valid = [];

    for (const row of draft.rows) {
      const state = classifyRow(row, { columns, seen });
      if (state === "ready") {
        seen.add(normaliseEmail(row.email));
        valid.push(row);
      } else if (state !== "blank") {
        skipped.push({ id: row.id, reason: STATE_LABELS[state] });
      }
      // Blank rows are neither committed nor reported — they are just the empty
      // rows at the bottom of a grid.
    }

    if (valid.length === 0) {
      return NextResponse.json({ committed: 0, skipped });
    }

    // One Company and one Application per company/role pairing in the draft.
    // Resolved before the write below rather than inside it, because consuming
    // a quota slot is its own transaction — a company that has been counted
    // must exist even if the contacts under it fail to insert.
    const committable = [];
    // Shared across groups: two roles at one employer draw on the same room.
    const roomByCompany = new Map();

    for (const group of groupRows(valid)) {
      const { company } = await ensureCompany(auth.userId, group.company);

      const slug = toRoleSlug(group.role);
      const application = await prisma.jobApplication.upsert({
        where: {
          companyId_roleSlug_campaignId: {
            companyId: company.id,
            roleSlug: slug,
            campaignId: draft.campaignId,
          },
        },
        create: {
          companyId: company.id,
          campaignId: draft.campaignId,
          role: group.role || null,
          roleSlug: slug,
        },
        update: {},
        select: { id: true },
      });

      // Deliverability, not billing: how many contacts at this employer are
      // still being emailed, across every role and campaign. Finished, replied
      // and bounced contacts have stopped generating mail, so they free their
      // slot — which is what lets a new posting months later start fresh.
      let room = roomByCompany.get(company.id);
      if (room === undefined) {
        room = await companyContactRoom(company.id);
      }

      group.rows.forEach((row) => {
        if (room > 0) {
          committable.push({ row, applicationId: application.id });
          room -= 1;
        } else {
          skipped.push({ id: row.id, reason: STATE_LABELS.contactCap });
        }
      });

      roomByCompany.set(company.id, room);
    }

    if (committable.length === 0) {
      return NextResponse.json({ committed: 0, skipped });
    }

    const committedIds = committable.map(({ row }) => row.id);

    // One transaction: either the contacts exist and the draft rows are gone,
    // or neither happened. A partial commit would leave the user re-adding
    // leads that were already created.
    await prisma.$transaction([
      prisma.campaignLead.createMany({
        // Field shape matches what CSV import produced, so committed leads are
        // indistinguishable from previously imported ones downstream. `sentAt`
        // is set to now because the leads table sorts on it — it means "added
        // at", not "emailed at", for a PENDING row.
        //
        // `personalization` keeps its copy of company and role even though the
        // application now holds them structurally: it is what {{company}} and
        // {{role}} render from when the pitch is sent.
        data: committable.map(({ row, applicationId }) => ({
          name: row.name || "",
          email: (row.email || "").trim(),
          campaignId: draft.campaignId,
          applicationId,
          status: "PENDING",
          verified: "PENDING",
          sentAt: new Date(),
          openCount: 0,
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
