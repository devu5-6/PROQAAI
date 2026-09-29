import type { Meta, StoryObj } from "@storybook/react";
import { ErrorState } from "./ErrorState";

const meta = {
  title: "Design System/ErrorState",
  component: ErrorState,
} satisfies Meta<typeof ErrorState>;

export default meta;
type Story = StoryObj<typeof ErrorState>;

export const Default: Story = {
  args: {
    onRetry: () => undefined,
  },
};

export const Retrying: Story = {
  args: {
    onRetry: () => undefined,
    retrying: true,
  },
};
