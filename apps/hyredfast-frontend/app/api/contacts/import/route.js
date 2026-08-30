import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { tryAuth } from "@/lib/auth";
import { ownsCampaign, notFound } from "@/lib/authz";
import { ensureCompany, companyContactRoom } from "@/lib/quota";
import { roleSlug as toRoleSlug } from "@/lib/company";
import { MAX_ACTIVE_CONTACTS_PER_COMPANY } from "@/lib/constants/plans";

/**
 * Add contacts to a campaign one at a time (the Add Lead dialog).
 *
 * The composer is the bulk path and validates at its own commit gate; this is
 * the single-contact path, but it builds the same hierarchy. A contact added
 * here still resolves to a Company and an Application, so it shows up in the
 * grouped leads list alongside composed ones instead of falling into the "no
 * company set" bucket, and it consumes a quota slot on the same terms.
 *
 * A contact naming no company resolves to the user's "(Unassigned)"
 * placeholder, which is free — it represents no decision to apply anywhere.
 */
export async function POST(request) {
  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;

  const { contacts, campaign } = await request.json();

  if (!(await ownsCampaign(auth.userId, campaign))) return notFound("Campaign");
  if (!Array.isArray(contacts) || contacts.length === 0) {
    return NextResponse.json({ message: "No contacts", count: 0 });
  }

  try {
    // Resolved per distinct company/role pairing rather than per contact, so a
    // batch naming one employer issues one upsert.
    const applications = new Map();
    // Room is per COMPANY, so two roles at one employer draw on the same
    // allowance rather than getting one each.
    const roomByCompany = new Map();
    const prepared = [];
    const skipped = [];

    for (const contact of contacts) {
      const company = String(contact.personalization?.company ?? "").trim();
      const role = String(contact.personalization?.role ?? "").trim();
      // \u0000 as the separator, written as an escape rather than a literal:
      // a raw NUL in the source makes grep and most editors treat the file
      // as binary. A company name can contain a space, so a space would not
      // separate the pair unambiguously.
      const key = `${company.toLowerCase()}\u0000${role.toLowerCase()}`;

      if (!applications.has(key)) {
        const { company: record } = await ensureCompany(auth.userId, company);
        const slug = toRoleSlug(role);
        const application = await prisma.jobApplication.upsert({
          where: {
            companyId_roleSlug_campaignId: {
              companyId: record.id,
              roleSlug: slug,
              campaignId: campaign,
            },
          },
          create: {
            companyId: record.id,
            campaignId: campaign,
            role: role || null,
            roleSlug: slug,
          },
          update: {},
          select: { id: true },
        });

        if (!roomByCompany.has(record.id)) {
          roomByCompany.set(record.id, await companyContactRoom(record.id));
        }
        applications.set(key, { id: application.id, companyId: record.id });
      }

      const target = applications.get(key);
      if (roomByCompany.get(target.companyId) <= 0) {
        skipped.push({ email: contact.email, reason: "contactCap" });
        continue;
      }
      roomByCompany.set(
        target.companyId,
        roomByCompany.get(target.companyId) - 1,
      );

      prepared.push({
        name: contact.name,
        email: contact.email,
        campaignId: campaign,
        applicationId: target.id,
        status: "PENDING",
        sentAt: new Date(),
        openCount: 0,
        stage: 0,
        personalization: contact.personalization || undefined,
      });
    }

    if (prepared.length === 0) {
      return NextResponse.json(
        {
          message: `You can have ${MAX_ACTIVE_CONTACTS_PER_COMPANY} contacts in progress at one company. Finish or remove some before adding more.`,
          count: 0,
          skipped,
        },
        { status: 409 },
      );
    }

    const created = await prisma.campaignLead.createMany({ data: prepared });

    return NextResponse.json({
      message: "Contacts imported",
      count: created.count,
      skipped,
    });
  } catch (error) {
    console.error(
      `[API] Error importing contacts for campaign ${campaign}:`,
      error,
    );
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
