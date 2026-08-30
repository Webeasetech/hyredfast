import prisma from "@/lib/prisma";
import { PLANS } from "@/lib/constants/plans";
import {
  MAX_ACTIVE_CONTACTS_PER_COMPANY,
  ACTIVE_CONTACT_STATUSES,
} from "@/lib/constants/plans";
import { companySlug, isBillable, UNASSIGNED_SLUG } from "@/lib/company";

/**
 * Credits and the per-company contact limit.
 *
 * There is no company allowance any more: credits are the only thing that
 * limits sending, and they are spent by the send pipeline rather than by
 * anything in here. What is left is a plan's expiry, and a deliverability
 * guardrail on how many contacts may be in flight at one employer.
 */

/** Term end for a plan bought now. */
export function termEnd(plan, from = new Date()) {
  const end = new Date(from);
  end.setUTCMonth(end.getUTCMonth() + plan.termMonths);
  return end;
}

function planFor(user) {
  if (!user?.planId || !user?.planExpiresAt) return null;
  if (new Date(user.planExpiresAt) <= new Date()) return null;
  return PLANS[user.planId] ?? null;
}

/**
 * The user's sending balance.
 *
 * `credits` is the live number the send pipeline decrements, so this is a read
 * of it plus whether the term is still running. An expired term reports zero
 * remaining even when credits are left, because the credits died with it.
 */
export async function getBalance(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      credits: true,
      planId: true,
      planStartedAt: true,
      planExpiresAt: true,
    },
  });

  const plan = planFor(user);
  const since = user?.planStartedAt ?? undefined;

  // Both counted, never derived from each other. A balance can carry credits
  // from before the term and can be topped up mid-term, so `granted - credits`
  // is not the number sent — it goes negative on a leftover balance and
  // under-reports after a top-up.
  const [sent, added] = await Promise.all([
    since
      ? prisma.campaignMessage.count({
          where: {
            sent: true,
            created: { gte: since },
            campaignLead: { campaign: { userId } },
          },
        })
      : 0,
    since
      ? prisma.payment
          .aggregate({
            where: {
              userId,
              status: "PAID",
              fulfilledAt: { gte: since },
            },
            _sum: { creditsGranted: true },
          })
          .then((r) => r._sum.creditsGranted ?? 0)
      : 0,
  ]);

  return {
    planId: user?.planId ?? null,
    planActive: Boolean(plan),
    planStartedAt: user?.planStartedAt ?? null,
    planExpiresAt: user?.planExpiresAt ?? null,
    credits: user?.credits ?? 0,
    remaining: plan ? (user?.credits ?? 0) : 0,
    /** Emails actually sent since the term began. */
    sent,
    /** Credits bought during this term, top-ups included. */
    added,
  };
}

/**
 * Find or create a company for this user.
 *
 * Consumes nothing. Companies used to cost a quota slot, which is exactly the
 * charge that could not be justified when the user deleted one — so creating a
 * company is now free and the emails sent to its contacts are what cost.
 */
export async function ensureCompany(userId, name) {
  const trimmed = String(name ?? "").trim();
  const slug = trimmed ? companySlug(trimmed) : UNASSIGNED_SLUG;

  const existing = await prisma.company.findUnique({
    where: { userId_slug: { userId, slug } },
  });
  if (existing) return { company: existing, created: false };

  // Two composer tabs can finish at once, so a lost race means the row already
  // exists rather than that anything went wrong.
  try {
    const company = await prisma.company.create({
      data: {
        userId,
        slug,
        name: isBillable(slug) ? trimmed : "(Unassigned)",
      },
    });
    return { company, created: true };
  } catch (error) {
    if (error?.code === "P2002") {
      const raced = await prisma.company.findUnique({
        where: { userId_slug: { userId, slug } },
      });
      if (raced) return { company: raced, created: false };
    }
    throw error;
  }
}

/**
 * How many more contacts may be added at this company right now.
 *
 * Counts only contacts still being emailed, across every role and campaign at
 * that employer — the recipient domain is what a spam filter scores, not the
 * job title. A completed, replied or bounced contact has stopped generating
 * mail, so it stops occupying a slot.
 */
export async function companyContactRoom(companyId) {
  const active = await prisma.campaignLead.count({
    where: {
      application: { companyId },
      status: { in: ACTIVE_CONTACT_STATUSES },
    },
  });

  return Math.max(0, MAX_ACTIVE_CONTACTS_PER_COMPANY - active);
}

/** Adds credits to a user. Used by payment fulfilment only. */
export async function grantCredits(tx, userId, credits) {
  await tx.user.update({
    where: { id: userId },
    data: { credits: { increment: credits } },
  });
}
