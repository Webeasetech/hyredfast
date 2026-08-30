import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { tryAuth } from "@/lib/auth";
import { ownsCampaign, notFound } from "@/lib/authz";
import { buildLeadsFilter } from "@/lib/leads-filter";
import { UNASSIGNED_SLUG } from "@/lib/company";

/**
 * Leads for a campaign, paged by application rather than by lead.
 *
 * An application is one company/role pairing — the unit the composer writes in
 * and the unit the hierarchy stores, so it is the unit the list reads in: a
 * page holds GROUPS_PER_PAGE applications and every lead inside them, so a
 * company is never split down the middle by a page boundary.
 *
 * That means the page size in *leads* varies — five applications might be 12
 * leads or 50 (the per-company cap bounds it). The alternative, paging leads
 * and grouping what came back, made a group mean "the leads from this company
 * that happened to land on this page", which is not a thing anyone wants to
 * read.
 *
 * The grouping is now the `application` foreign key rather than a fold of the
 * personalization JSON, so a group here is the row the composer created, not a
 * string match that could drift from it.
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

    // Pass one: just enough to work out which applications the filtered leads
    // fall into, and in what order. Two small columns over the filtered set,
    // rather than the whole rows — those are fetched below for the page only.
    const keys = await prisma.campaignLead.findMany({
      where,
      orderBy,
      select: { id: true, applicationId: true },
    });

    // Applications in first-appearance order, which under the default
    // NEWEST_FIRST puts the most recently active one first and reverses with
    // the sort, as it should.
    const order = [];
    const idsByApplication = new Map();
    for (const row of keys) {
      const key = row.applicationId ?? "";
      if (!idsByApplication.has(key)) {
        idsByApplication.set(key, []);
        order.push(key);
      }
      idsByApplication.get(key).push(row.id);
    }

    const totalPages = Math.max(1, Math.ceil(order.length / GROUPS_PER_PAGE));
    const pageKeys = order.slice(
      (page - 1) * GROUPS_PER_PAGE,
      page * GROUPS_PER_PAGE,
    );

    // Pass two: the full records, for this page's applications only.
    const ids = pageKeys.flatMap((key) => idsByApplication.get(key));
    const items = await prisma.campaignLead.findMany({
      where: { id: { in: ids } },
      include: { cred: { select: { username: true } } },
    });

    // Reshape to match old format: put cred in expand
    const byId = new Map(
      items.map((item) => {
        const { cred, ...rest } = item;
        return [item.id, { ...rest, expand: { cred: cred || undefined } }];
      }),
    );

    const applications = await prisma.jobApplication.findMany({
      where: { id: { in: pageKeys.filter(Boolean) } },
      select: {
        id: true,
        role: true,
        company: { select: { name: true, slug: true } },
      },
    });
    const byApplication = new Map(applications.map((a) => [a.id, a]));

    const groups = pageKeys.map((key) => {
      const application = byApplication.get(key);
      // The placeholder company is an implementation detail of the backfill —
      // the list says "no company set", the same as a contact with no
      // application at all.
      const named =
        application && application.company.slug !== UNASSIGNED_SLUG
          ? application.company.name
          : "";

      return {
        key: key || "unassigned",
        applicationId: application?.id ?? null,
        company: named,
        role: application?.role || "",
        // Every lead in the group — that is the point of paging this way.
        items: idsByApplication
          .get(key)
          .map((id) => byId.get(id))
          .filter(Boolean),
      };
    });

    return NextResponse.json({
      groups,
      totalItems: keys.length,
      totalGroups: order.length,
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
