"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircleIcon, BuildingAIcon } from "mage-icons-react/bulk";
import { ReloadIcon } from "mage-icons-react/stroke";
import { SettingsNav } from "@/components/settings/settings-nav";
import useAuthStore from "@/store/auth.store";
import { get, post } from "@/lib/apis";
import { PLANS, formatInr } from "@/lib/constants/plans";
import { toast } from "sonner";

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
    <div className="container mx-auto">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1">
          <SettingsNav />
        </div>

        <div className="md:col-span-3">
          <BillingSettings />
        </div>
      </div>
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
        name: "Denshees",
        description: `${order.companies} companies`,
        prefill: order.prefill,
        theme: { color: "#000000" },
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
      <div className="border border-black bg-white p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
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
            <div className="text-4xl font-bold font-mono">{remaining}</div>
            <div className="text-sm text-gray-600">Remaining</div>
          </div>
          <div>
            <div className="text-2xl font-mono">{used}</div>
            <div className="text-sm text-gray-600">Used</div>
          </div>
          <div>
            <div className="text-2xl font-mono">{total}</div>
            <div className="text-sm text-gray-600">Purchased</div>
          </div>
        </div>
      </div>

      <div className="border border-black bg-white p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
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

      <div className="border border-black bg-white p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <h2 className="text-xl font-bold mb-4">What a company includes</h2>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Company research and a should-you-apply verdict</li>
          <li>• A tailored résumé and cover letter for the role</li>
          <li>• Up to 10 contacts, with outreach sequences written per contact</li>
          <li>• One-time purchase, no subscription, no expiry</li>
        </ul>
      </div>
    </div>
  );
}

function PlanCard({ plan, isPending, isDisabled, onBuy }) {
  return (
    <div className="border-2 border-black bg-white p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col">
      <h3 className="text-lg font-bold flex items-center gap-2">
        <BuildingAIcon className="h-5 w-5" />
        {plan.label}
      </h3>
      <p className="text-sm text-gray-600 mt-1">{plan.description}</p>

      <div className="mt-6 flex items-baseline gap-2">
        <span className="text-3xl font-bold font-mono">
          {formatInr(plan.amount)}
        </span>
        <span className="text-sm text-gray-600">one-time</span>
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
