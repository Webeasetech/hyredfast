"use client";

import { useState } from "react";
import { PanelSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { EmailIcon, SaveFloppyIcon } from "mage-icons-react/bulk";
import { PlusIcon, ReloadIcon, TrashIcon } from "mage-icons-react/stroke";
import useSWR from "swr";
import fetcher from "@/lib/fetcher";
import useSWRMutation from "swr/mutation";
import { patch, remove } from "@/lib/apis";
import { toast } from "sonner";
import CreateSMTP from "@/components/campaigns/settings/create-smtp";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Email settings"
        description="Connect and manage the inboxes you send from"
      />

      <EmailSettings />
    </div>
  );
}

function EmailSettings() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLimits, setEditingLimits] = useState({});
  const [savingIds, setSavingIds] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch available email accounts
  const {
    data: emailAccounts,
    isLoading,
    error,
    mutate: refreshEmails,
  } = useSWR("/api/google_apps", fetcher);

  // Setup mutation for updating email daily limit
  const { trigger: updateEmailLimit } = useSWRMutation(
    "/api/google_apps/update",
    patch,
  );

  const handleDailyLimitChange = (id, value) => {
    setEditingLimits((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleSaveDailyLimit = async (email) => {
    const newLimit = Number.parseInt(
      editingLimits[email.id] || email.dailyLimit,
    );

    if (isNaN(newLimit) || newLimit < 1) {
      toast.error("Please enter a valid daily limit");
      return;
    }

    setSavingIds((prev) => [...prev, email.id]);

    try {
      await updateEmailLimit({
        id: email.id,
        dailyLimit: newLimit,
      });
      toast.success("Daily limit updated successfully");
      refreshEmails();
    } catch (error) {
      toast.error("Failed to update daily limit");
      console.error("Error updating daily limit:", error);
    } finally {
      setSavingIds((prev) => prev.filter((id) => id !== email.id));
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await remove(`/api/google_apps/${deleteTarget.id}`);
      toast.success("Email account removed");
      setDeleteTarget(null);
      refreshEmails();
    } catch (error) {
      const message =
        error?.response?.data?.message || "Failed to remove email account";
      toast.error(message);
      // Refresh so usage counts reflect reality if a campaign changed.
      refreshEmails();
    } finally {
      setIsDeleting(false);
    }
  };

  const isBlocked = (deleteTarget?.activeCampaignCount || 0) > 0;

  if (isLoading) {
    return <PanelSkeleton lines={3} />;
  }

  if (error) {
    return (
      <div className="border border-border bg-white p-6 rounded-lg">
        <div className="flex flex-col justify-center items-center h-40">
          <p className="text-lg text-red-600">Failed to load email accounts</p>
          <Button onClick={() => refreshEmails()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const emails = emailAccounts || [];

  return (
    <div id="email-settings">
      <div className="rounded-lg border border-border bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
          <h2 className="text-xl font-bold">Connected Email Accounts</h2>
          <Button onClick={() => setIsDialogOpen(true)}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Setup New Email
          </Button>
        </div>

        {emails.length === 0 ? (
          <div className="p-6 text-center">
            <EmailIcon className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-medium text-foreground">
              No email accounts
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Add an email account to use in your campaigns
            </p>
            <div className="mt-6">
              <Button onClick={() => setIsDialogOpen(true)}>
                <PlusIcon className="mr-2 h-4 w-4" />
                Setup Email
              </Button>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Email</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>
                  Daily Limit
                  <span className="block text-xs font-normal text-muted-foreground">
                    Gmail allows 500/day, Workspace 2,000. Staying well under
                    protects the account.
                  </span>
                </TableHead>
                <TableHead className="pr-6 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.map((email) => (
                <TableRow key={email.id}>
                  <TableCell className="pl-6 font-medium">
                    {email.username}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {email.host}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`daily-limit-${email.id}`}
                        type="number"
                        min="1"
                        className="w-20"
                        value={
                          editingLimits[email.id] !== undefined
                            ? editingLimits[email.id]
                            : email.dailyLimit || 100
                        }
                        onChange={(e) =>
                          handleDailyLimitChange(email.id, e.target.value)
                        }
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSaveDailyLimit(email)}
                        disabled={savingIds.includes(email.id)}
                      >
                        {savingIds.includes(email.id) ? (
                          <ReloadIcon className="h-4 w-4 animate-spin" />
                        ) : (
                          <SaveFloppyIcon className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Remove ${email.username}`}
                      onClick={() => setDeleteTarget(email)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Setup Email Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Setup Email Account</DialogTitle>
          </DialogHeader>
          <CreateSMTP />
        </DialogContent>
      </Dialog>

      {/* Delete Credential Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isBlocked
                ? "Can't remove this account"
                : "Remove email account?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isBlocked
                ? `${deleteTarget?.username} is used in ${
                    deleteTarget?.activeCampaignCount
                  } active campaign${
                    deleteTarget?.activeCampaignCount === 1 ? "" : "s"
                  }. Unselect it from those campaigns before you can remove it.`
                : `${deleteTarget?.username} isn't used in any active campaign. This removes it permanently and can't be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {isBlocked ? "Close" : "Cancel"}
            </AlertDialogCancel>
            {!isBlocked && (
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleConfirmDelete();
                }}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <ReloadIcon className="h-4 w-4 mr-2 animate-spin" />
                    Removing...
                  </>
                ) : (
                  "Remove"
                )}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
