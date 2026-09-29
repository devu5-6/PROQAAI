import type { Meta, StoryObj } from "@storybook/react";
import { SkeletonRows } from "./SkeletonRows";

const meta = {
  title: "Design System/SkeletonRows",
  component: SkeletonRows,
} satisfies Meta<typeof SkeletonRows>;

export default meta;
type Story = StoryObj<typeof SkeletonRows>;

export const SixRows: Story = { args: { rows: 6 } };
