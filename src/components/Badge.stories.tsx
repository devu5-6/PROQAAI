import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./Badge";

const meta = {
  title: "Design System/Badge",
  component: Badge,
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof Badge>;

export const Waiting: Story = { args: { status: "waiting" } };
export const Called: Story = { args: { status: "called" } };
export const Served: Story = { args: { status: "served" } };
export const NoShow: Story = { args: { status: "no_show" } };
