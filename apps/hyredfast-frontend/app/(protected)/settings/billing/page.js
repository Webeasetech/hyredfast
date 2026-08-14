"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircleIcon, BuildingAIcon } from "mage-icons-react/bulk";
import { ReloadIcon } from "mage-icons-react/stroke";
import useAuthStore from "@/store/auth.store";
import { get, post } from "@/lib/apis";
import { PLANS, formatInr } from "@/lib/constants/plans";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";

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
        description="Buy companies and track what you have left"
      />

      <BillingSettings />
    </div>
  );
}

function BillingSettings() {
  const { user, updateUser } = useAuthStore();
  const [pendingPlan, setPendingPlan] = useState(null);
  const [testMode, setTestMode] = useState(false);

  const total = user?.companiesTotal || 0;
  const used = user?.companiesUsed || 0;
  const remaining = Math.max(0, total - used);

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
        description: `${order.companies} companies`,
        prefill: order.prefill,
        handler: async (response) => {
          try {
            await post("/api/payments/verify", { arg: response });
            await refreshUser();
            toast.success(`${order.companies} companies added`);
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
          <h2 className="text-xl font-bold">Companies</h2>
          {testMode && (
            <Badge variant="outline" className="font-mono">
              Test mode
            </Badge>
          )}
        </div>
        <div className="mt-6 flex items-end gap-8">
          <div>
            <div className="text-4xl font-bold tabular-nums">{remaining}</div>
            <div className="text-sm text-muted-foreground">Remaining</div>
          </div>
          <div>
            <div className="text-2xl tabular-nums">{used}</div>
            <div className="text-sm text-muted-foreground">Used</div>
          </div>
          <div>
            <div className="text-2xl tabular-nums">{total}</div>
            <div className="text-sm text-muted-foreground">Purchased</div>
          </div>
        </div>
      </div>

      <div className="border border-border bg-white p-6 rounded-lg">
        <h2 className="text-xl font-bold mb-6">Buy companies</h2>

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
        <h2 className="text-xl font-bold mb-4">What a company includes</h2>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Company research and a should-you-apply verdict</li>
          <li>• A tailored résumé and cover letter for the role</li>
          <li>
            • Up to 10 contacts, with outreach sequences written per contact
          </li>
          <li>• One-time purchase, no subscription, no expiry</li>
        </ul>
      </div>
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
        <span className="text-sm text-muted-foreground">one-time</span>
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-sm">
        <CheckCircleIcon className="h-4 w-4" />
        {plan.companies} companies
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
        ) : (
          `Buy ${plan.companies} companies`
        )}
      </Button>
    </div>
  );
}
