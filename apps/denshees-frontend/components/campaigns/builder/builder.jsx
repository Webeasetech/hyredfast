"use client";

import { useCallback, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import useSWR from "swr";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { ReloadIcon } from "mage-icons-react/stroke";
import fetcher from "@/lib/fetcher";
import { patch, post, remove } from "@/lib/apis";
import UpdateTemplate from "@/components/campaigns/builder/update-template";
import StartNode from "@/components/campaigns/builder/flow/nodes/start-node";
import EmailNode from "@/components/campaigns/builder/flow/nodes/email-node";
import DelayNode from "@/components/campaigns/builder/flow/nodes/delay-node";
import AddNode from "@/components/campaigns/builder/flow/nodes/add-node";
import OutcomeNode from "@/components/campaigns/builder/flow/nodes/outcome-node";
import { useCampaignFlow } from "@/components/campaigns/builder/flow/use-campaign-flow";
import AutoFit from "@/components/campaigns/builder/flow/auto-fit";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const nodeTypes = {
  start: StartNode,
  email: EmailNode,
  delay: DelayNode,
  add: AddNode,
  outcome: OutcomeNode,
};

const percent = (part, whole) =>
  whole > 0 ? Math.round((part / whole) * 100) : 0;

const errorMessage = (error, fallback) =>
  error?.response?.data?.message || fallback;

const Builder = ({ campaign }) => {
  const pitchesKey = `/api/pitches?campaign=${campaign}`;
  const {
    data: pitchData,
    isLoading: pitchesLoading,
    mutate: mutatePitches,
  } = useSWR(pitchesKey, fetcher);
  const { data: contactsData, isLoading: contactsLoading } = useSWR(
    `/api/contacts?campaign=${campaign}`,
    fetcher,
  );

  const [selectedPitch, setSelectedPitch] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const pitches = useMemo(() => pitchData?.items ?? [], [pitchData]);

  const stats = useMemo(() => {
    const contacts = contactsData ?? [];
    const totalContacts = contacts.length;

    const contactsPerStage = {};
    const repliesPerStage = {};

    contacts.forEach((contact) => {
      const stage = contact.stage ?? 0;
      contactsPerStage[stage] = (contactsPerStage[stage] ?? 0) + 1;

      if (contact.status === "REPLIED") {
        const repliedStage = contact.replied_at_stage ?? stage;
        repliesPerStage[repliedStage] =
          (repliesPerStage[repliedStage] ?? 0) + 1;
      }
    });

    const replied = contacts.filter((c) => c.status === "REPLIED").length;
    const opened = contacts.filter(
      (c) => c.opened > 0 && c.status !== "REPLIED",
    ).length;
    const noReply = contacts.filter(
      (c) =>
        c.stage >= (pitches.length || 1) &&
        c.status !== "REPLIED" &&
        c.opened === 0,
    ).length;

    return {
      totalContacts,
      contactsPerStage,
      repliesPerStage,
      outcomes: {
        replied: {
          count: replied,
          percentage: percent(replied, totalContacts),
        },
        opened: { count: opened, percentage: percent(opened, totalContacts) },
        "no-reply": {
          count: noReply,
          percentage: percent(noReply, totalContacts),
        },
      },
    };
  }, [contactsData, pitches.length]);

  const handleAddPitch = useCallback(async () => {
    setBusy(true);
    try {
      await post(`/api/pitches/create?campaign=${campaign}`, { arg: {} });
      await mutatePitches();
      toast.success("Follow-up added");
    } catch (error) {
      toast.error(errorMessage(error, "Could not add follow-up"));
    } finally {
      setBusy(false);
    }
  }, [campaign, mutatePitches]);

  const confirmDeletePitch = useCallback(async () => {
    const pitch = pendingDelete;
    if (!pitch) return;

    setPendingDelete(null);
    setBusy(true);
    try {
      await remove(`/api/pitches/delete?pitch=${pitch.id}`, { arg: {} });
      if (selectedPitch?.id === pitch.id) setSelectedPitch(null);
      await mutatePitches();
      toast.success("Follow-up removed");
    } catch (error) {
      toast.error(errorMessage(error, "Could not remove follow-up"));
    } finally {
      setBusy(false);
    }
  }, [pendingDelete, selectedPitch, mutatePitches]);

  const handleSaveDelay = useCallback(
    async (pitch, delayDays) => {
      const optimistic = {
        ...pitchData,
        items: pitches.map((item) =>
          item.id === pitch.id ? { ...item, delayDays } : item,
        ),
      };

      try {
        await mutatePitches(
          async () => {
            await patch(`/api/pitches/update?pitch=${pitch.id}`, {
              arg: { delayDays },
            });
            return fetcher(pitchesKey);
          },
          { optimisticData: optimistic, rollbackOnError: true },
        );
      } catch (error) {
        toast.error(errorMessage(error, "Could not update delay"));
      }
    },
    [pitchData, pitches, mutatePitches, pitchesKey],
  );

  const handlers = useMemo(
    () => ({
      onOpenPitch: setSelectedPitch,
      onDeletePitch: setPendingDelete,
      onAddPitch: handleAddPitch,
      onSaveDelay: handleSaveDelay,
      busy,
    }),
    [handleAddPitch, handleSaveDelay, busy],
  );

  const { nodes, edges } = useCampaignFlow({
    pitches,
    stats,
    handlers,
    selectedPitchId: selectedPitch?.id,
  });

  const structureKey = useMemo(
    () => nodes.map((node) => node.id).join("|"),
    [nodes],
  );

  if (pitchesLoading || contactsLoading) {
    return (
      <div className="h-[500px] rounded-lg border border-border p-4">
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  return (
    <div className="w-full grow">
      <div className="relative h-[560px] overflow-hidden rounded-lg border border-border bg-muted/40">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          // elementsSelectable must stay on: with draggable, connectable and
          // selectable all false, xyflow renders node wrappers with
          // pointer-events: none, making node content unclickable.
          elementsSelectable
          proOptions={{ hideAttribution: true }}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={1.5}
        >
          <AutoFit structureKey={structureKey} />
          <Background
            variant={BackgroundVariant.Dots}
            gap={16}
            size={1}
            color="hsl(var(--border))"
          />
          <Controls
            showInteractive={false}
            className="overflow-hidden! rounded-lg! border! border-border!"
          />
          <MiniMap
            pannable
            zoomable
            className="rounded-lg! border! border-border!"
          />

          <Panel
            position="top-left"
            className="rounded-lg border border-border bg-background p-3"
          >
            <h3 className="text-sm font-semibold">Email Campaign Flow</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Click an email to edit it, or a delay to change its wait.
            </p>
          </Panel>
        </ReactFlow>

        <AnimatePresence>
          {busy && (
            <motion.div
              className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-[1px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3">
                <ReloadIcon className="size-4 animate-spin text-muted-foreground" />
                <span className="text-sm font-medium">Updating flow...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* The template editor opens beside the flow rather than covering it, so
          the sequence stays visible while an email is being written. */}
      <Sheet
        open={!!selectedPitch}
        onOpenChange={(open) => !open && setSelectedPitch(null)}
      >
        <SheetContent
          side="right"
          className="w-full gap-0 p-0 sm:max-w-xl lg:max-w-2xl"
        >
          <SheetHeader className="border-b border-border px-6 py-4">
            <SheetTitle className="text-base">
              {selectedPitch?.stage === 0
                ? "First email"
                : `Follow-up ${selectedPitch?.stage}`}
            </SheetTitle>
            <SheetDescription>
              Changes are saved automatically.
            </SheetDescription>
          </SheetHeader>

          {selectedPitch && (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-4">
              <UpdateTemplate
                campaign={campaign}
                stage={selectedPitch}
                message={selectedPitch.message}
                subject={selectedPitch.subject}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this follow-up?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `Follow-up ${pendingDelete.stage} and its template will be permanently deleted. This can't be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmDeletePitch}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Builder;
