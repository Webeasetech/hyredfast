"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";

const AddNode = ({ data }) => (
  <div className="h-full">
    <Handle
      type="target"
      position={Position.Left}
      className="bg-gray-500! border-2! border-white! w-2.5! h-2.5!"
    />

    <button
      type="button"
      onClick={data.onAdd}
      disabled={data.disabled}
      className="w-full h-full flex items-center justify-center gap-1 text-sm font-medium bg-white text-black border-2 border-dashed border-gray-500 hover:border-border hover:border-solid transition-all disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
    >
      <span className="text-base leading-none">+</span> Add follow-up
    </button>
  </div>
);

export default memo(AddNode);
