import type { Meta, StoryObj } from "@storybook/react";
import { Select } from "./Select";

const meta = {
  title: "Design System/Select",
  component: Select,
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  args: {
    label: "Queue",
    options: [
      { value: "general", label: "General queue" },
      { value: "vaccination", label: "Vaccination queue" },
      { value: "billing", label: "Billing queue" },
    ],
  },
};
