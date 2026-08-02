"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ExclamationTriangleIcon, TrashIcon } from "mage-icons-react/bulk";
import { useRouter } from "next/navigation";
import useSWRMutation from "swr/mutation";
import { patch } from "@/lib/apis";

const DangerZone = ({ campaignId }) => {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  // Setup mutation for deleting campaign
  const { trigger: deleteCampaign } = useSWRMutation(
    `/api/campaign/${campaignId}`,
    patch,
    {
      onSuccess: () => {
        toast.success("Campaign deleted successfully");
        router.push("/campaigns");
      },
      onError: () => {
        toast.error("Failed to delete campaign");
        setIsDeleting(false);
        setShowConfirm(false);
      },
    },
  );

  const handleDeleteClick = () => {
    setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (confirmText !== "delete") {
      toast.error("Please type 'delete' to confirm");
      return;
    }

    setIsDeleting(true);
    try {
      await deleteCampaign({ deleted: true });
    } catch (error) {
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  return (
    // A neutral card with a destructive edge, rather than a wall of red: the
    // tint is reserved for the action row so the risky control is what stands
    // out instead of the whole panel.
    <div className="overflow-hidden rounded-lg border border-destructive/30 bg-background">
      <div className="flex items-start gap-3 p-4 md:p-6">
        <ExclamationTriangleIcon className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Danger zone</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Actions here cause permanent data loss and cannot be undone.
          </p>
        </div>
      </div>

      {!showConfirm ? (
        <div className="flex flex-col gap-3 border-t border-destructive/20 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
          <div className="min-w-0">
            <h3 className="text-sm font-medium">Delete campaign</h3>
            <p className="text-sm text-muted-foreground">
              Permanently removes this campaign and all of its data.
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={handleDeleteClick}
            className="shrink-0"
          >
            <TrashIcon className="mr-2 size-4" />
            Delete campaign
          </Button>
        </div>
      ) : (
        <div className="space-y-3 border-t border-destructive/20 bg-destructive/5 p-4 md:px-6">
          <div className="space-y-1.5">
            <Label htmlFor="danger-confirm" className="text-sm font-medium">
              Type <span className="font-semibold">delete</span> to confirm
            </Label>
            <Input
              id="danger-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="delete"
              autoComplete="off"
              className="max-w-sm bg-background"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowConfirm(false);
                setConfirmText("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting || confirmText !== "delete"}
            >
              {isDeleting ? "Deleting…" : "Delete campaign"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DangerZone;
