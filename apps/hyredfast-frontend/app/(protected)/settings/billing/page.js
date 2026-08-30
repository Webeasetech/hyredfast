"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircleIcon, BuildingAIcon } from "mage-icons-react/bulk";
import { ReloadIcon } from "mage-icons-react/stroke";
import useAuthStore from "@/store/auth.store";
import { get, post } from "@/lib/apis";
import {
  PLANS,
  formatInr,
  MAX_ACTIVE_CONTACTS_PER_COMPANY,
} from "@/lib/constants/plans";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

/** Loads Checkout.js on first purchase rather than on every page view. */
function loadCheckoutScript() {
  if (typeof window === "undefined") return Promise.reject();
  if (window.Razorpay) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${CHECKOUT_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", resolve);
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

export default function BillingSettingsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Billing"
        description="Your plan and how many emails you have left"
      />

      <BillingSettings />
    </div>
  );
}

function BillingSettings() {
  const { user, updateUser } = useAuthStore();
  const [pendingPlan, setPendingPlan] = useState(null);
  const [testMode, setTestMode] = useState(false);

  // One credit is one email. Nothing refills — this is a lump bought up front
  // and spent down, so "used" is derived from the plan size rather than stored.
  const balance = user?.balance;
  const remaining = balance?.remaining || 0;
  const planActive = Boolean(balance?.planActive);
  // Counted, not derived: a balance can carry credits from before the term and
  // can be topped up during it, so subtracting one from the other lies.
  const sent = balance?.sent || 0;
  const added = balance?.added || 0;
  const expires = balance?.planExpiresAt
    ? new Date(balance.planExpiresAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  async function refreshUser() {
    try {
      const fresh = await get("/api/user/view");
      updateUser(fresh);
    } catch {
      // Balance will catch up on the next page load.
    }
  }

  async function handleBuy(planId) {
    setPendingPlan(planId);
    try {
      await loadCheckoutScript();
      const order = await post("/api/payments/create", { arg: { planId } });
      setTestMode(order.mode === "test");

      const checkout = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "HyredFast",
        description: `${order.credits.toLocaleString("en-IN")} emails`,
        prefill: order.prefill,
        handler: async (response) => {
          try {
            await post("/api/payments/verify", { arg: response });
            await refreshUser();
            toast.success(
              order.termMonths
                ? `Plan active — ${order.credits.toLocaleString("en-IN")} emails added`
                : `${order.credits.toLocaleString("en-IN")} emails added`,
            );
          } catch {
            // The webhook is authoritative and will still grant — say so
            // rather than implying the payment failed.
            toast.message("Payment received", {
              description: "Your balance will update shortly.",
            });
          } finally {
            setPendingPlan(null);
          }
        },
        modal: { ondismiss: () => setPendingPlan(null) },
      });

      checkout.on("payment.failed", (response) => {
        toast.error(response?.error?.description || "Payment failed");
        setPendingPlan(null);
      });

      checkout.open();
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error(
        error?.response?.data?.error || "Could not start checkout. Try again.",
      );
      setPendingPlan(null);
    }
  }

  return (
    <div id="billing-settings" className="space-y-6">
      <div className="border border-border bg-white p-6 rounded-lg">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-bold">Emails</h2>
          {testMode && (
            <Badge variant="outline" className="font-mono">
              Test mode
            </Badge>
          )}
        </div>
        <div className="mt-6 flex items-end gap-8">
          <div>
            <div className="text-4xl font-bold tabular-nums">
              {remaining.toLocaleString("en-IN")}
            </div>
            <div className="text-sm text-muted-foreground">Remaining</div>
          </div>
          <div>
            <div className="text-2xl tabular-nums">
              {sent.toLocaleString("en-IN")}
            </div>
            <div className="text-sm text-muted-foreground">Sent this term</div>
          </div>
          <div>
            <div className="text-2xl tabular-nums">
              {added.toLocaleString("en-IN")}
            </div>
            <div className="text-sm text-muted-foreground">Added this term</div>
          </div>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          {planActive
            ? `One credit is one email.${expires ? ` Unused emails expire when your plan ends on ${expires}.` : ""}`
            : "No active plan. Buy one below to start sending."}
        </p>
      </div>

      <div className="border border-border bg-white p-6 rounded-lg">
        <h2 className="text-xl font-bold mb-6">Plans</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Object.values(PLANS).map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isPending={pendingPlan === plan.id}
              isDisabled={pendingPlan !== null}
              onBuy={() => handleBuy(plan.id)}
            />
          ))}
        </div>
      </div>

      <div className="border border-border bg-white p-6 rounded-lg">
        <h2 className="text-xl font-bold mb-1">Where 15,000 comes from</h2>
        <p className="text-sm text-muted-foreground mb-5">
          A full search, sized generously.
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <Figure value="300" label="companies" />
          <span className="text-muted-foreground">&times;</span>
          <Figure
            value={MAX_ACTIVE_CONTACTS_PER_COMPANY}
            label="contacts each"
          />
          <span className="text-muted-foreground">&times;</span>
          <Figure value="5" label="emails per contact" />
          <span className="text-muted-foreground">=</span>
          <Figure value="15,000" label="emails" accent />
        </div>

        <p className="mt-5 text-sm text-muted-foreground">
          Five emails per contact is the first message plus four follow-ups.
          Most people reply before the fourth, so the real figure per contact is
          closer to three.
        </p>
      </div>

      <div className="border border-border bg-white p-6 rounded-lg">
        <h2 className="text-xl font-bold mb-1">What you can actually send</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Credits are not the limit for most people. Your connected inboxes are.
          Each one sends up to its own daily limit, so adding a second inbox
          doubles your pace.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[420px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left font-medium text-muted-foreground pb-2">
                  Inboxes
                </th>
                <th className="text-left font-medium text-muted-foreground pb-2">
                  Daily limit each
                </th>
                <th className="text-left font-medium text-muted-foreground pb-2">
                  Emails in 3 months
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[
                [1, 20, "1,800"],
                [2, 30, "5,400"],
                [3, 40, "10,800"],
                [4, 45, "16,200"],
              ].map(([boxes, limit, total]) => (
                <tr
                  key={boxes}
                  className="border-b border-border last:border-0"
                >
                  <td className="py-2">{boxes}</td>
                  <td className="py-2">{limit}</td>
                  <td className="py-2 font-medium">{total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-5 text-sm text-muted-foreground">
          15,000 is headroom, not a target. On one inbox you will use about
          1,800 of it, and that is fine. The allowance is there so you never
          have to stop mid search to buy more.
        </p>
      </div>

      <div className="border border-border bg-white p-6 rounded-lg">
        <h2 className="text-xl font-bold mb-1">
          Sending limits that keep you safe
        </h2>
        <p className="text-sm text-muted-foreground mb-5">
          These protect your own inbox. Cold email that goes out too fast gets
          the sending account flagged, and that is the account you are job
          hunting from.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <Limit
            value="20 a day"
            title="Per inbox, by default"
            body="Raise it in Email settings once an inbox has been sending steadily for a few weeks. Gmail allows around 500 a day, but cold outreach should stay far below that."
          />
          <Limit
            value="1 every 25s"
            title="Spacing per inbox"
            body="Enforced automatically. Different inboxes send at the same time, so pace scales with how many you connect, not with how hard you push one."
          />
          <Limit
            value={`${MAX_ACTIVE_CONTACTS_PER_COMPANY} contacts`}
            title="In progress at one company"
            body="Counts only people you are still emailing. Finish a sequence, get a reply, or bounce and the slot frees up, so a new opening at the same company starts fresh."
          />
        </div>
      </div>

      <div className="border border-border bg-white p-6 rounded-lg">
        <h2 className="text-xl font-bold mb-4">Without an active plan</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium mb-2">Still works</p>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li>Adding companies, roles and contacts</li>
              <li>Writing and editing your email sequences</li>
              <li>The CRM board, analytics and reports</li>
              <li>Reading replies that arrive in your inbox</li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Stops</p>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li>Sending, including scheduled follow-ups</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-3">
              Nothing is deleted or cancelled. Campaigns pause where they are
              and pick up from the same point once you top up.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** One number in the sizing breakdown. */
function Figure({ value, label, accent }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span
        className={cn(
          "text-lg font-bold tabular-nums",
          accent && "text-primary",
        )}
      >
        {value}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

/** One sending limit, with the reason it exists. */
function Limit({ value, title, body }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-base font-bold tabular-nums">{value}</p>
      <p className="text-sm font-medium mt-0.5">{title}</p>
      <p className="text-sm text-muted-foreground mt-2">{body}</p>
    </div>
  );
}

function PlanCard({ plan, isPending, isDisabled, onBuy }) {
  return (
    <div className="border border-border rounded-lg p-6 flex flex-col">
      <h3 className="text-lg font-bold flex items-center gap-2">
        <BuildingAIcon className="h-5 w-5" />
        {plan.label}
      </h3>
      <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>

      <div className="mt-6 flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums">
          {formatInr(plan.amount)}
        </span>
        <span className="text-sm text-muted-foreground">
          {plan.termMonths ? `for ${plan.termMonths} months` : "one-time"}
        </span>
      </div>

      <div className="mt-3 space-y-1.5 text-sm">
        <p className="flex items-center gap-1.5">
          <CheckCircleIcon className="h-4 w-4 shrink-0" />
          {plan.credits.toLocaleString("en-IN")} emails, follow-ups included
        </p>
        <p className="flex items-center gap-1.5">
          <CheckCircleIcon className="h-4 w-4 shrink-0" />
          {plan.termMonths
            ? `Roughly ${Math.round(plan.credits / 5 / MAX_ACTIVE_CONTACTS_PER_COMPANY)} companies at ${MAX_ACTIVE_CONTACTS_PER_COMPANY} contacts each`
            : "Added to your current plan, expires with it"}
        </p>
        <p className="text-muted-foreground pl-[22px]">
          {(plan.amount / 100 / plan.credits).toFixed(2)} rupees per email
        </p>
      </div>

      <Button
        className="w-full mt-6"
        size="lg"
        onClick={onBuy}
        disabled={isDisabled}
      >
        {isPending ? (
          <>
            <ReloadIcon className="h-4 w-4 mr-2 animate-spin" />
            Opening checkout
          </>
        ) : plan.termMonths ? (
          `Get ${plan.termMonths} months`
        ) : (
          `Add ${plan.credits.toLocaleString("en-IN")} emails`
        )}
      </Button>
    </div>
  );
}
