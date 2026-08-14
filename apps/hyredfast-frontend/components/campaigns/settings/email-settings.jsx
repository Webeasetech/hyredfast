"use client";

import { useState, useEffect, useCallback } from "react";
import { PanelSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { EmailIcon, Trash2Icon } from "mage-icons-react/bulk";
import { PlusIcon } from "mage-icons-react/stroke";
import useSWR from "swr";
import fetcher from "@/lib/fetcher";
import useSWRMutation from "swr/mutation";
import { SaveStatus } from "@/components/save-status";
import { useAutosave } from "@/hooks/use-autosave";
import { patch } from "@/lib/apis";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
} from "@/components/ui/dialog";
import CreateSMTP from "@/components/campaigns/settings/create-smtp";
import { Checkbox } from "@/components/ui/checkbox";

const EmailSettings = ({ campaignId }) => {
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Fetch available email accounts
  const {
    data: emailAccounts,
    isLoading: emailsLoading,
    mutate: refreshEmails,
  } = useSWR("/api/google_apps", fetcher);

  // Fetch currently selected emails for this campaign
  const { data: selectedEmailsData, isLoading: selectedEmailsLoading } = useSWR(
    campaignId ? `/api/campaign/${campaignId}/selected-emails` : null,
    fetcher,
    {
      onSuccess: (data) => {
        if (data && Array.isArray(data)) {
          setSelectedEmails(data.map((email) => email.id));
        }
      },
    },
  );

  // Setup mutation for updating campaign emails
  const { trigger: updateCampaignEmails, isMutating } = useSWRMutation(
    `/api/campaign/${campaignId}`,
    patch,
    {
      onSuccess: () => {
        toast.success("Email settings updated successfully");
      },
      onError: () => {
        toast.error("Failed to update email settings");
      },
    },
  );

  // Setup mutation for deleting email accounts
  const { trigger: deleteEmailAccount, isMutating: isDeleting } =
    useSWRMutation(
      "/api/google_apps/delete",
      async (url, { arg }) => {
        const response = await fetch(url, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(arg),
        });

        if (!response.ok) {
          throw new Error("Failed to delete email account");
        }

        return response.json();
      },
      {
        onSuccess: () => {
          toast.success("Email account deleted successfully");
          refreshEmails();
        },
        onError: () => {
          toast.error("Failed to delete email account");
        },
      },
    );

  const { status, save } = useAutosave(
    useCallback(
      (emails) => updateCampaignEmails({ emails }),
      [updateCampaignEmails],
    ),
  );

  // Selecting a mailbox persists immediately — the next state is computed here
  // because setState hasn't flushed by the time we need the payload.
  const handleEmailToggle = (emailId) => {
    const next = selectedEmails.includes(emailId)
      ? selectedEmails.filter((id) => id !== emailId)
      : [...selectedEmails, emailId];
    setSelectedEmails(next);
    save(next);
  };

  const handleDeleteEmail = async (emailId, e) => {
    e.stopPropagation();

    if (confirm("Are you sure you want to delete this email account?")) {
      try {
        await deleteEmailAccount({ id: emailId });

        // If the deleted email was selected, remove it from selected emails
        if (selectedEmails.includes(emailId)) {
          setSelectedEmails((prev) => prev.filter((id) => id !== emailId));
        }
      } catch (error) {
        console.error("Error deleting email account:", error);
      }
    }
  };

  if (emailsLoading || selectedEmailsLoading) {
    return <PanelSkeleton lines={3} />;
  }

  const emails = emailAccounts || [];

  return (
    <div className="border border-border bg-white p-6 rounded-lg">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          {/* Matches the Campaign Details card heading — this was
              text-xl/bold while that one is text-base/semibold. */}
          <h2 className="text-base font-semibold">Email Accounts</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select the email accounts you want to use for this campaign. Emails
            will be sent from these accounts in rotation.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <SaveStatus status={status} />
          <Button onClick={() => setIsDialogOpen(true)} size="sm">
            <PlusIcon className="mr-2 h-4 w-4" />
            Setup Email
          </Button>
        </div>
      </div>

      {emails.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <EmailIcon className="mx-auto size-8 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-medium text-foreground">
            No email accounts
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Add an email account to use in your campaigns
          </p>
        </div>
      ) : (
        // Rows were `border p-4` with no radius and a 16px gap, so they read
        // as loose sharp-cornered boxes beside the rounded cards.
        <div className="space-y-2">
          {emails.map((email) => (
            <div
              key={email.id}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                selectedEmails.includes(email.id)
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-accent"
              }`}
              onClick={() => handleEmailToggle(email.id)}
            >
              <Checkbox
                checked={selectedEmails.includes(email.id)}
                // The row owns the click; the box is a visual indicator so
                // it must not swallow the event and toggle twice.
                tabIndex={-1}
                className="pointer-events-none"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{email.username}</p>
                <p className="text-xs text-muted-foreground">
                  Daily limit: {email.dailyLimit} emails
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Setup Email Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Setup Email Account</DialogTitle>
          </DialogHeader>
          <CreateSMTP />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailSettings;
