"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JOB_TYPES } from "@/lib/team/parse-quick-entry";
import {
  WORK_CATEGORIES,
  WORK_CATEGORY_META,
  resolveWorkCategory,
} from "@/lib/team/work-category";
import {
  allocationForJob,
  useTeamPlannerStore,
} from "@/lib/store/team-planner-store";
import type { Priority } from "@/lib/types";

const PRIORITIES: Priority[] = ["low", "normal", "high", "urgent"];

export function JobEditor() {
  const selectedJobId = useTeamPlannerStore((state) => state.selectedJobId);
  const jobs = useTeamPlannerStore((state) => state.jobs);
  const allocations = useTeamPlannerStore((state) => state.allocations);
  const consultants = useTeamPlannerStore((state) => state.consultants);
  const weekStart = useTeamPlannerStore((state) => state.weekStart);
  const selectedDate = useTeamPlannerStore((state) => state.selectedDate);
  const selectedConsultantId = useTeamPlannerStore((state) => state.selectedConsultantId);
  const updateJob = useTeamPlannerStore((state) => state.updateJob);
  const updateAllocation = useTeamPlannerStore((state) => state.updateAllocation);
  const assignJob = useTeamPlannerStore((state) => state.assignJob);
  const unassignJob = useTeamPlannerStore((state) => state.unassignJob);
  const deleteJob = useTeamPlannerStore((state) => state.deleteJob);
  const selectJob = useTeamPlannerStore((state) => state.selectJob);

  const job = selectedJobId ? jobs[selectedJobId] : undefined;
  const allocation = job ? allocationForJob({ allocations }, job.id) : undefined;
  const [address, setAddress] = useState(job?.address ?? "");
  const [notes, setNotes] = useState(job?.notes ?? "");

  if (!job) return null;

  const currentJob = job;
  const consultant = allocation
    ? consultants.find((item) => item.id === allocation.consultantId)
    : undefined;
  const fallbackConsultantId = selectedConsultantId ?? consultants[0]?.id ?? "c-alex";
  const fallbackDate = allocation?.scheduledDate ?? selectedDate ?? weekStart;

  function persistText() {
    if (address.trim() && address.trim() !== currentJob.address) {
      updateJob(currentJob.id, { address: address.trim() });
    }
    if (notes !== (currentJob.notes ?? "")) {
      updateJob(currentJob.id, { notes: notes || undefined });
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col border-l border-hairline bg-white">
      <div className="flex items-start justify-between gap-2 border-b border-hairline px-3 py-2.5">
        <div className="min-w-0">
          <p className="eyebrow">{job.jobNumber ?? "Demo job"}</p>
          <h2 className="mt-0.5 truncate text-[14px] font-semibold text-slate-900">
            {job.suburb || job.address}
          </h2>
        </div>
        <button
          type="button"
          aria-label="Close editor"
          onClick={() => {
            persistText();
            selectJob(null);
          }}
          className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-auto px-3 py-3">
        <label className="block space-y-1">
          <span className="field-label">Location / address</span>
          <input
            className="field-input"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            onBlur={persistText}
          />
        </label>
        <label className="block space-y-1">
          <span className="field-label">Job type</span>
          <select
            className="field-input"
            value={job.title ?? ""}
            onChange={(event) => updateJob(job.id, { title: event.target.value || undefined })}
          >
            <option value="">Not set</option>
            {JOB_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className="field-label mb-1.5">Work category</span>
          <div className="grid grid-cols-1 gap-0.5">
            {WORK_CATEGORIES.map((id) => {
              const item = WORK_CATEGORY_META[id];
              const selected = resolveWorkCategory(job.workCategory) === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => updateJob(job.id, { workCategory: id })}
                  className="h-7 rounded-[2px] px-2 text-left text-[11px] font-medium"
                  style={{
                    backgroundColor: item.fill,
                    color: item.text,
                    boxShadow: selected ? "inset 0 0 0 2px #1a2744" : undefined,
                  }}
                >
                  {item.keyLabel}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="field-label">Date</span>
            <input
              type="date"
              className="field-input"
              value={allocation?.scheduledDate ?? ""}
              onChange={(event) => {
                const date = event.target.value;
                if (!date) return;
                if (allocation) {
                  updateAllocation(allocation.id, { scheduledDate: date });
                } else {
                  assignJob(job.id, fallbackConsultantId, date);
                }
              }}
            />
          </label>
          <label className="space-y-1">
            <span className="field-label">Time</span>
            <input
              type="time"
              className="field-input"
              value={allocation?.startTime ?? ""}
              onChange={(event) => {
                if (!allocation) return;
                updateAllocation(allocation.id, {
                  startTime: event.target.value || undefined,
                });
              }}
            />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="field-label">Consultant</span>
          <select
            className="field-input"
            value={allocation?.consultantId ?? ""}
            onChange={(event) => {
              const consultantId = event.target.value;
              if (!consultantId) {
                unassignJob(job.id);
                return;
              }
              if (allocation) {
                updateAllocation(allocation.id, { consultantId });
              } else {
                assignJob(job.id, consultantId, fallbackDate);
              }
            }}
          >
            <option value="">Unassigned</option>
            {consultants.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="field-label">Duration (min)</span>
            <input
              type="number"
              min={15}
              step={15}
              className="field-input"
              value={job.estimatedMinutes}
              onChange={(event) =>
                updateJob(job.id, { estimatedMinutes: Number(event.target.value) || 60 })
              }
            />
          </label>
          <label className="space-y-1">
            <span className="field-label">Due date</span>
            <input
              type="date"
              className="field-input"
              value={job.dueDate ?? ""}
              onChange={(event) =>
                updateJob(job.id, { dueDate: event.target.value || undefined })
              }
            />
          </label>
        </div>
        <div>
          <span className="field-label mb-1.5">Priority</span>
          <div className="grid grid-cols-4 gap-1">
            {PRIORITIES.map((value) => (
              <button
                key={value}
                type="button"
                aria-label={`Priority ${value}`}
                onClick={() => updateJob(job.id, { priority: value })}
                className={
                  (job.priority ?? "normal") === value
                    ? "h-7 rounded-md border border-brand bg-brand/[0.08] text-[11px] font-medium text-brand-strong capitalize"
                    : "h-7 rounded-md border border-hairline text-[11px] font-medium text-slate-600 capitalize hover:border-slate-300"
                }
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        <label className="block space-y-1">
          <span className="field-label">Notes</span>
          <textarea
            rows={2}
            className="w-full rounded-lg border border-hairline px-2.5 py-2 text-[12.5px] outline-none focus:border-brand focus:ring-3 focus:ring-brand/15"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            onBlur={persistText}
          />
        </label>
        {consultant ? (
          <p className="text-[11px] text-slate-400">
            Allocated to {consultant.name}
            {allocation?.startTime ? ` · ${allocation.startTime}` : ""}
          </p>
        ) : (
          <p className="text-[11px] text-slate-400">In the unassigned queue</p>
        )}
      </div>

      <div className="space-y-1 border-t border-hairline px-2 py-2">
        <Button
          type="button"
          className="h-8 w-full bg-brand text-[12px] text-white hover:bg-brand-strong"
          onClick={() => {
            persistText();
            selectJob(null);
          }}
        >
          Save
        </Button>
        {allocation ? (
          <button
            type="button"
            onClick={() => unassignJob(job.id)}
            className="flex h-8 w-full items-center rounded-md px-2 text-[12px] text-slate-500 hover:bg-slate-50 hover:text-slate-800"
          >
            Move to unassigned
          </button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          className="h-8 w-full justify-start text-[12px] text-rose-700 hover:bg-rose-50"
          onClick={() => deleteJob(job.id)}
        >
          Delete demo job
        </Button>
      </div>
    </section>
  );
}
