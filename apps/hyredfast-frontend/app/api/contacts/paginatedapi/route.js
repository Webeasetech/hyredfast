import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { tryAuth } from "@/lib/auth";
import { ownsCampaign, notFound } from "@/lib/authz";
import { buildLeadsFilter } from "@/lib/leads-filter";
import { groupRows } from "@/lib/lead-draft";

/**
 * Leads for a campaign, paged by company/role group rather than by lead.
 *
 * A group is the unit the composer writes in, so it is the unit the list reads
 * in: a page holds GROUPS_PER_PAGE groups and every lead inside them, so a
 * company is never split down the middle by a page boundary.
 *
 * That means the page size in *leads* varies — five groups might be 12 leads or
 * 120. The alternative, paging leads and grouping what came back, is what this
 * route used to do, and it made a group mean "the leads from this company that
 * happened to land on this page", which is not a thing anyone wants to read.
 */
const GROUPS_PER_PAGE = 5;

export async function GET(request) {
  const searchParams = new URL(request.url).searchParams;
  const campaign = searchParams.get("campaign");
  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;
  if (!(await ownsCampaign(auth.userId, campaign))) return notFound("Campaign");
  const page = parseInt(searchParams.get("page") || "1");

  try {
    const { where, orderBy } = buildLeadsFilter(searchParams);

    // Pass one: just enough to work out what the groups are and how they are
    // ordered. Three small columns over the filtered set, rather than the whole
    // rows — the full records are fetched below, only for the page's groups.
    const keys = await prisma.campaignEmail.findMany({
      where,
      orderBy,
      select: { id: true, personalization: true },
    });

    // The same grouping the composer and the table use, so a group here is
    // always the same group there. Rows arrive in `orderBy` order and groupRows
    // preserves first appearance, which puts the most recently active group
    // first under NEWEST_FIRST — and reverses with the sort, as it should.
    const allGroups = groupRows(keys);
    const totalPages = Math.max(1, Math.ceil(allGroups.length / GROUPS_PER_PAGE));
    const pageGroups = allGroups.slice(
      (page - 1) * GROUPS_PER_PAGE,
      page * GROUPS_PER_PAGE,
    );

    // Pass two: the full records, for this page's groups only.
    const ids = pageGroups.flatMap((group) => group.rows.map((row) => row.id));
    const items = await prisma.campaignEmail.findMany({
      where: { id: { in: ids } },
      orderBy,
      include: { cred: { select: { username: true } } },
    });

    // Reshape to match old format: put cred in expand
    const byId = new Map(
      items.map((item) => {
        const { cred, ...rest } = item;
        return [item.id, { ...rest, expand: { cred: cred || undefined } }];
      }),
    );

    const groups = pageGroups.map((group) => ({
      key: group.key,
      company: group.company,
      role: group.role,
      // Every lead in the group — that is the point of paging this way.
      items: group.rows.map((row) => byId.get(row.id)).filter(Boolean),
    }));

    return NextResponse.json({
      groups,
      totalItems: keys.length,
      totalGroups: allGroups.length,
      page,
      perPage: GROUPS_PER_PAGE,
      totalPages,
    });
  } catch (error) {
    console.error(
      `[API] Error getting paginated contacts for campaign ${campaign}:`,
      error,
    );
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
