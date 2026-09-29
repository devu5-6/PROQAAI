import type { Meta, StoryObj } from "@storybook/react";
import { Drawer } from "./Drawer";
import { Button } from "./Button";

const meta = {
  title: "Design System/Drawer",
  component: Drawer,
} satisfies Meta<typeof Drawer>;

export default meta;
type Story = StoryObj<typeof Drawer>;

function Body() {
  return (
    <>
      <div className="drawer-header">
        <h2>Amara Okafor</h2>
        <Button variant="ghost">✕ Close</Button>
      </div>
      <div className="drawer-body">
        <dl className="detail-grid">
          <div className="detail-item">
            <dt className="label">Phone</dt>
            <dd className="value">(+1) 555-0142</dd>
          </div>
          <div className="detail-item">
            <dt className="label">Visit reason</dt>
            <dd className="value">Follow-up: blood panel</dd>
          </div>
        </dl>
      </div>
    </>
  );
}

export const Open: Story = {
  args: { open: true, onClose: () => undefined, title: "Customer details", children: <Body /> },
};
